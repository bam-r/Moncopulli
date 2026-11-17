// Cálculos para Resumen, Reportes, Bodegas e Historial. Todo se calcula en el navegador
// con los datos que entrega la API (son pocos registros), sin endpoints extra.
import { esAnulado, parseDate } from './format'

export const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ───────────── Períodos ───────────── */
export const PERIODOS = { 7: 'Última semana', 30: 'Último mes', 90: 'Últimos 3 meses' }

export const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

// "Últimos N días" incluye hoy: N=7 -> desde hace 6 días a hoy.
export function rangoUltimos(dias, hoy = new Date()) {
  const fin = sumarDias(inicioDia(hoy), 1) // mañana 00:00 (exclusivo)
  return { ini: sumarDias(fin, -dias), fin }
}
export const rangoAnterior = (r) => {
  const largo = Math.round((r.fin - r.ini) / 86400000)
  return { ini: sumarDias(r.ini, -largo), fin: r.ini }
}
export const enRango = (fecha, r) => fecha >= r.ini && fecha < r.fin

// Serie diaria sin huecos: [{ fecha, valor }]
export function serieDiaria(items, { fecha, valor }, r) {
  const dias = Math.round((r.fin - r.ini) / 86400000)
  const mapa = new Map()
  for (let i = 0; i < dias; i++) mapa.set(sumarDias(r.ini, i).getTime(), 0)
  items.forEach((it) => {
    const k = inicioDia(fecha(it)).getTime()
    if (mapa.has(k)) mapa.set(k, mapa.get(k) + valor(it))
  })
  return [...mapa.entries()].map(([k, v]) => ({ fecha: new Date(k), valor: v }))
}

// Para períodos largos se agrupa por semana (lunes a domingo) para que el gráfico se lea bien.
export function agruparSemanas(serie) {
  const mapa = new Map()
  serie.forEach((p) => {
    const lunes = sumarDias(p.fecha, -((p.fecha.getDay() + 6) % 7))
    const k = lunes.getTime()
    mapa.set(k, (mapa.get(k) ?? 0) + p.valor)
  })
  return [...mapa.entries()].map(([k, v]) => ({ fecha: new Date(k), valor: v }))
}

/* ───────────── Stock por bodega ───────────── */
export const stockEn = (producto, bodegaId) =>
  Number(producto?.stock_por_bodega?.find((s) => s.bodega === Number(bodegaId))?.cantidad ?? 0)

export const bodegasConStock = (producto) =>
  (producto?.stock_por_bodega ?? []).filter((s) => Number(s.cantidad) > 0).map((s) => ({ bodega: s.bodega, cantidad: Number(s.cantidad) }))

export const valorStock = (p) => Number(p.stock_actual) * Number(p.costo_promedio)

/* ───────────── Consumos ───────────── */
export const vigentes = (lista) => lista.filter((x) => !esAnulado(x))
export const fechaConsumo = (c) => parseDate(c.fecha)

// Promedio de consumo diario de un producto en los últimos `dias` días.
export function consumoDiario(consumos, productoId, dias = 30, hoy = new Date()) {
  const r = rangoUltimos(dias, hoy)
  const total = vigentes(consumos)
    .filter((c) => c.producto === productoId && enRango(fechaConsumo(c), r))
    .reduce((s, c) => s + Number(c.cantidad_retirada), 0)
  return total / dias
}

// Días que alcanza el stock al ritmo de los últimos 30 días (null si no hay consumo).
export function diasDeStock(producto, consumos) {
  const diario = consumoDiario(consumos, producto.id)
  if (diario <= 0) return null
  return Number(producto.stock_actual) / diario
}

export function agrupar(items, clave) {
  const m = new Map()
  items.forEach((it) => {
    const k = clave(it)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(it)
  })
  return m
}

// Retiros por trabajador dentro de un rango.
export function retirosPorTrabajador(consumos, usuarios, productos, r) {
  const prod = new Map(productos.map((p) => [p.id, p]))
  const usu = new Map(usuarios.map((u) => [u.id, u]))
  const filas = []
  agrupar(vigentes(consumos).filter((c) => enRango(fechaConsumo(c), r)), (c) => c.usuario).forEach((lista, id) => {
    const porProducto = new Map()
    let valor = 0
    lista.forEach((c) => {
      const p = prod.get(c.producto)
      porProducto.set(c.producto, (porProducto.get(c.producto) ?? 0) + Number(c.cantidad_retirada))
      valor += Number(c.cantidad_retirada) * Number(p?.costo_promedio ?? 0)
    })
    const masRetirado = [...agrupar(lista, (c) => c.producto).entries()].sort((a, b) => b[1].length - a[1].length)[0]
    filas.push({
      id,
      nombre: usu.get(id)?.nombre_completo ?? 'Usuario',
      puesto: usu.get(id)?.puesto ?? '',
      retiros: lista.length,
      valor,
      insumos: porProducto.size,
      masRetirado: prod.get(masRetirado?.[0])?.nombre ?? '—',
      ultimo: lista.reduce((a, c) => (fechaConsumo(c) > a ? fechaConsumo(c) : a), new Date(0)),
    })
  })
  return filas.sort((a, b) => b.retiros - a.retiros || b.valor - a.valor)
}

// Compras (documentos) con su total y quién las registró.
export function documentosConTotal(documentos, detalles) {
  const total = new Map()
  const lineas = new Map()
  detalles.forEach((d) => {
    total.set(d.documento, (total.get(d.documento) ?? 0) + Number(d.cantidad) * Number(d.precio_unitario))
    if (!lineas.has(d.documento)) lineas.set(d.documento, [])
    lineas.get(d.documento).push(d)
  })
  return documentos.map((d) => ({ ...d, fecha: parseDate(d.fecha_emision), total: total.get(d.id) ?? 0, lineas: lineas.get(d.id) ?? [] }))
}

export function comprasPorTrabajador(docs, usuarios, r) {
  const usu = new Map(usuarios.map((u) => [u.id, u]))
  const filas = []
  agrupar(docs.filter((d) => enRango(d.fecha, r)), (d) => d.usuario).forEach((lista, id) => {
    filas.push({
      id,
      nombre: usu.get(id)?.nombre_completo ?? 'Usuario',
      puesto: usu.get(id)?.puesto ?? '',
      compras: lista.length,
      total: lista.reduce((s, d) => s + d.total, 0),
      ultima: lista.reduce((a, d) => (d.fecha > a ? d.fecha : a), new Date(0)),
    })
  })
  return filas.sort((a, b) => b.total - a.total)
}

// Variación porcentual (null si antes no había nada con qué comparar).
export const variacion = (actual, anterior) => (anterior > 0 ? ((actual - anterior) / anterior) * 100 : null)
