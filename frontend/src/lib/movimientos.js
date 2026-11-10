import { parseDate, esAnulado } from './format'

export function construirMovimientos({ consumos, documentos, detalles, productos, usuarios, proveedores }) {
  const prod = new Map(productos.map((p) => [p.id, p]))
  const usu = new Map(usuarios.map((u) => [u.id, u]))
  const prov = new Map(proveedores.map((p) => [p.id, p]))

  const salidas = consumos
    .filter((c) => !esAnulado(c))
    .map((c) => {
      const p = prod.get(c.producto)
      return {
        key: `c${c.id}`,
        tipo: 'salida',
        fecha: parseDate(c.fecha),
        conHora: true,
        usuario: usu.get(c.usuario)?.nombre_completo ?? 'Un usuario',
        producto: p?.nombre ?? 'insumo',
        cantidad: Number(c.cantidad_retirada),
        unidad: p?.unidad_medida ?? '',
      }
    })

  const doc = new Map(documentos.map((d) => [d.id, d]))
  const entradas = detalles
    .filter((d) => doc.has(d.documento))
    .map((d) => {
      const dc = doc.get(d.documento)
      const p = prod.get(d.producto)
      return {
        key: `d${d.id}`,
        tipo: 'entrada',
        fecha: parseDate(dc.fecha_emision),
        conHora: false,
        proveedor: prov.get(dc.proveedor)?.nombre ?? 'proveedor',
        producto: p?.nombre ?? 'insumo',
        codigo: p?.codigo,
        cantidad: Number(d.cantidad),
        unidad: p?.unidad_medida ?? '',
      }
    })

  return [...salidas, ...entradas].sort((a, b) => b.fecha - a.fecha)
}

export function ultimoConsumoPorUsuario(consumos, productos) {
  const prod = new Map(productos.map((p) => [p.id, p]))
  const out = new Map()
  consumos.filter((c) => !esAnulado(c)).forEach((c) => {
    const f = parseDate(c.fecha)
    const prev = out.get(c.usuario)
    if (!prev || f > prev.fecha) {
      const p = prod.get(c.producto)
      out.set(c.usuario, { fecha: f, cantidad: Number(c.cantidad_retirada), unidad: p?.unidad_medida ?? '', producto: p?.nombre ?? '' })
    }
  })
  return out
}

export function ultimoInventario(inventarios, detallesInv) {
  const ultimo = inventarios.filter((i) => !esAnulado(i)).sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha))[0]
  if (!ultimo) return null
  const det = detallesInv.filter((d) => d.inventario === ultimo.id)
  const sis = det.reduce((s, d) => s + Number(d.stock_sistema), 0)
  const real = det.reduce((s, d) => s + Number(d.stock_real), 0)
  return { fecha: parseDate(ultimo.fecha), desviacion: sis ? ((real - sis) / sis) * 100 : 0 }
}
