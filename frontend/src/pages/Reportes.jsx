import { useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, CalendarClock, ClipboardList, Download, Hourglass, Package, Printer,
  Scale, ShoppingCart, TrendingUp, TriangleAlert, Truck, Users, Wallet,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { Badge, Estado, LinkButton, PageHeader, Select, StatCard } from '../components/ui'
import { BarList, ColumnChart, GraficoCard, LineChart } from '../components/charts'
import ProductoPicker from '../components/ProductoPicker'
import { descargarCSV } from '../lib/csv'
import { dmy, esAnulado, hm, num, parseDate, pesos } from '../lib/format'
import { ESTADO_STOCK, estadoStock } from '../lib/stock'
import {
  PERIODOS, agrupar, agruparSemanas, comprasPorTrabajador, diasDeStock, documentosConTotal, enRango, fechaConsumo,
  rangoUltimos, retirosPorTrabajador, serieDiaria, stockEn, sumarDias, valorStock, vigentes,
} from '../lib/analisis'

const RECURSOS = ['consumos', 'productos', 'usuarios', 'bodegas', 'proveedores', 'documentos-compra', 'detalle-documentos', 'inventarios', 'detalle-inventarios']
const TABS = [
  { id: 'retiros', label: 'Retiros', icon: ArrowUpRight },
  { id: 'compras', label: 'Compras', icon: ShoppingCart },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'desviacion', label: 'Desviación', icon: Scale },
  { id: 'precios', label: 'Variación de precio', icon: TrendingUp },
]
const fecha = (d) => dmy(d)
const signo = (v) => `${v > 0 ? '+' : ''}${num(v)}`
const fmtPct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`

function Tabla({ columnas, filas, vacio = 'No hay datos en este período.', clase = '' }) {
  return (
    <div className="table-wrap table-wrap--flush">
      <table className={`table table--compact ${clase}`}>
        <thead><tr>{columnas.map((c) => <th key={c.t} className={c.r ? 'right' : ''}>{c.t}</th>)}</tr></thead>
        <tbody>
          {filas.length === 0 && <tr><td colSpan={columnas.length} className="empty">{vacio}</td></tr>}
          {filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className={`${columnas[j].r ? 'right' : ''} ${columnas[j].n ? 'nowrap' : ''}`}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

function Seccion({ titulo, nota, accion, children }) {
  return (
    <section className="card table-card report-card">
      <div className="card__head"><div><h2>{titulo}</h2>{nota && <p className="sub">{nota}</p>}</div>{accion}</div>
      {children}
    </section>
  )
}

export default function Reportes() {
  const { usuario } = useAuth()
  const { data, loading, error } = useRecursos(RECURSOS)
  const [tab, setTab] = useState('retiros')
  const [periodo, setPeriodo] = useState('30')
  const [persona, setPersona] = useState('')
  const [productoId, setProductoId] = useState('')
  const [catStock, setCatStock] = useState('')
  const [precioProdId, setPrecioProdId] = useState(null)
  const detallePrecioRef = useRef(null)

  const diasPeriodo = Number(periodo)
  const rango = useMemo(() => rangoUltimos(diasPeriodo), [diasPeriodo])
  const periodoTxt = `${PERIODOS[periodo]} (${fecha(rango.ini)} al ${fecha(sumarDias(rango.fin, -1))})`

  const base = useMemo(() => {
    if (!data.consumos) return null
    return {
      prod: new Map(data.productos.map((p) => [p.id, p])),
      usu: new Map(data.usuarios.map((u) => [u.id, u])),
      bod: new Map(data.bodegas.map((b) => [b.id, b])),
      prov: new Map(data.proveedores.map((p) => [p.id, p])),
      docs: documentosConTotal(data['documentos-compra'], data['detalle-documentos']),
    }
  }, [data])

  /* ───── Retiros ───── */
  const ret = useMemo(() => {
    if (!base) return null
    const lista = vigentes(data.consumos).filter((c) => enRango(fechaConsumo(c), rango) && (!persona || String(c.usuario) === persona))
    const valor = (c) => Number(c.cantidad_retirada) * Number(base.prod.get(c.producto)?.costo_promedio ?? 0)
    const porInsumo = [...agrupar(lista, (c) => c.producto).entries()].map(([id, l]) => ({
      id, p: base.prod.get(id), retiros: l.length, cantidad: l.reduce((s, c) => s + Number(c.cantidad_retirada), 0), valor: l.reduce((s, c) => s + valor(c), 0),
    })).sort((a, b) => b.valor - a.valor)
    const trabajadores = retirosPorTrabajador(data.consumos.filter((c) => !persona || String(c.usuario) === persona), data.usuarios, data.productos, rango)
    const valorTotal = lista.reduce((s, c) => s + valor(c), 0)
    const gastoDiario = valorTotal / Math.max(diasPeriodo, 1)
    const gastoSemanal = gastoDiario * 7
    const gastoMensual = gastoDiario * 30
    return {
      lista,
      porInsumo,
      trabajadores,
      valorTotal,
      gastoDiario,
      gastoSemanal,
      gastoMensual,
      personas: new Set(lista.map((c) => c.usuario)).size,
    }
  }, [base, data, rango, persona, diasPeriodo])

  const masRetirado = ret ? [...ret.porInsumo].sort((a, b) => b.retiros - a.retiros)[0] : null
  const productoSel = productoId ? Number(productoId) : ret?.porInsumo[0]?.id
  const serieProducto = useMemo(() => {
    if (!ret || !productoSel) return null
    const reg = ret.lista.filter((c) => c.producto === productoSel)
    const diaria = serieDiaria(reg, { fecha: fechaConsumo, valor: (c) => Number(c.cantidad_retirada) }, rango)
    const semanal = diasPeriodo > 31
    const total = reg.reduce((s, c) => s + Number(c.cantidad_retirada), 0)
    return { serie: semanal ? agruparSemanas(diaria) : diaria, semanal, total, retiros: reg.length, porDia: total / diasPeriodo }
  }, [ret, productoSel, rango, diasPeriodo])

  /* ───── Compras ───── */
  const com = useMemo(() => {
    if (!base) return null
    const docs = base.docs.filter((d) => enRango(d.fecha, rango) && (!persona || String(d.usuario) === persona)).sort((a, b) => b.fecha - a.fecha)
    const total = docs.reduce((s, d) => s + d.total, 0)
    const porProv = [...agrupar(docs, (d) => d.proveedor).entries()]
      .map(([id, l]) => ({ id, nombre: base.prov.get(id)?.nombre ?? 'Proveedor', n: l.length, total: l.reduce((s, d) => s + d.total, 0) }))
      .sort((a, b) => b.total - a.total)
    const provPrincipal = porProv[0] ?? null
    const pctProv = provPrincipal && total > 0 ? Math.round((provPrincipal.total / total) * 100) : 0
    const gasto = serieDiaria(docs, { fecha: (d) => d.fecha, valor: (d) => d.total }, rango)
    return {
      docs,
      total,
      porProv,
      provPrincipal,
      pctProv,
      trabajadores: comprasPorTrabajador(base.docs.filter((d) => !persona || String(d.usuario) === persona), data.usuarios, rango),
      semanal: diasPeriodo > 31,
      gasto,
    }
  }, [base, data, rango, persona, diasPeriodo])

  /* ───── Stock ───── */
  const stock = useMemo(() => {
    if (!base) return null
    const filas = data.productos.filter((p) => !catStock || p.categoria === catStock).map((p) => ({ p, dias: diasDeStock(p, data.consumos), valor: valorStock(p), e: estadoStock(p) }))
      .sort((a, b) => ['sin', 'bajo', 'ok'].indexOf(a.e) - ['sin', 'bajo', 'ok'].indexOf(b.e) || a.p.nombre.localeCompare(b.p.nombre, 'es'))
    return { filas, valor: filas.reduce((s, f) => s + f.valor, 0), bajo: filas.filter((f) => f.e === 'bajo').length, sin: filas.filter((f) => f.e === 'sin').length, pocos: filas.filter((f) => f.dias != null && f.dias < 15 && f.e === 'ok').length }
  }, [base, data, catStock])

  /* ───── Desviación ───── */
  const des = useMemo(() => {
    if (!base) return null
    const invs = vigentes(data.inventarios).filter((i) => enRango(parseDate(i.fecha), rango)).sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha))
    const ids = new Set(invs.map((i) => i.id))
    const det = data['detalle-inventarios'].filter((d) => ids.has(d.inventario))
    const valorDe = (d) => Number(d.desviacion) * Number(base.prod.get(d.producto)?.costo_promedio ?? 0)
    const porInv = invs.map((i) => {
      const l = det.filter((d) => d.inventario === i.id)
      const sis = l.reduce((s, d) => s + Number(d.stock_sistema), 0), real = l.reduce((s, d) => s + Number(d.stock_real), 0)
      return { i, n: l.length, pct: sis ? ((real - sis) / sis) * 100 : 0, valor: l.reduce((s, d) => s + valorDe(d), 0), conDif: l.filter((d) => Number(d.desviacion) !== 0).length }
    })
    const porProd = [...agrupar(det, (d) => d.producto).entries()].map(([id, l]) => ({
      id, p: base.prod.get(id), veces: l.length, sis: l.reduce((s, d) => s + Number(d.stock_sistema), 0), real: l.reduce((s, d) => s + Number(d.stock_real), 0),
      dif: l.reduce((s, d) => s + Number(d.desviacion), 0), valor: l.reduce((s, d) => s + valorDe(d), 0),
    })).filter((x) => x.dif !== 0).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
    const sisT = det.reduce((s, d) => s + Number(d.stock_sistema), 0), realT = det.reduce((s, d) => s + Number(d.stock_real), 0)
    return { porInv, porProd, pct: sisT ? ((realT - sisT) / sisT) * 100 : 0, valor: det.reduce((s, d) => s + valorDe(d), 0), conDif: porProd.length }
  }, [base, data, rango])

  /* ───── Variación de precio (compras históricas por insumo y por categoría) ───── */
  const precios = useMemo(() => {
    if (!base) return null
    const docMap = new Map(base.docs.map((d) => [d.id, d]))
    const porProducto = new Map()

    data.productos.forEach((p) => porProducto.set(p.id, []))
    data['detalle-documentos'].forEach((det) => {
      const doc = docMap.get(det.documento)
      if (!doc || !porProducto.has(det.producto)) return
      porProducto.get(det.producto).push({
        id: det.id,
        documentoId: doc.id,
        fecha: doc.fecha,
        folio: doc.numero_folio,
        tipo: doc.tipo_documento,
        proveedorId: doc.proveedor,
        proveedor: base.prov.get(doc.proveedor)?.nombre ?? 'Proveedor',
        cantidad: Number(det.cantidad),
        precio: Number(det.precio_unitario),
      })
    })

    const resumenProd = new Map()
    porProducto.forEach((lista, id) => {
      lista.sort((a, b) => a.fecha - b.fecha || a.documentoId - b.documentoId || a.id - b.id)
      const puntos = lista.map((item, idx) => {
        const prev = idx > 0 ? lista[idx - 1] : null
        const diffPesos = prev ? item.precio - prev.precio : null
        const diffPct = prev && prev.precio > 0 ? ((item.precio - prev.precio) / prev.precio) * 100 : null
        return {
          ...item,
          key: item.id,
          valor: item.precio,
          diffPesos,
          diffPct,
          detalle: `${item.tipo} N° ${item.folio} · ${item.proveedor} (${num(item.cantidad)} ${base.prod.get(id)?.unidad_medida ?? ''})`,
        }
      })
      const primero = puntos[0]?.precio ?? Number(base.prod.get(id)?.costo_promedio ?? 0)
      const ultimo = puntos[puntos.length - 1]?.precio ?? primero
      const diff = ultimo - primero
      const pct = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0
      resumenProd.set(id, {
        id,
        producto: base.prod.get(id),
        puntos,
        compras: puntos.length,
        primero,
        ultimo,
        fechaPrimero: puntos[0]?.fecha ?? null,
        fechaUltimo: puntos[puntos.length - 1]?.fecha ?? null,
        diff,
        pct,
      })
    })

    const categorias = [...new Set(data.productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'es'))
    const porCategoria = categorias.map((cat) => {
      const items = data.productos.filter((p) => p.categoria === cat).map((p) => resumenProd.get(p.id)).filter(Boolean)
      const conCompras = items.filter((x) => x.compras > 1)
      const baseItems = conCompras.length ? conCompras : items
      const pct = baseItems.length ? baseItems.reduce((s, x) => s + x.pct, 0) / baseItems.length : 0
      const mayor = [...items].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0] ?? null
      return {
        categoria: cat,
        pct,
        insumos: items.length,
        mayor,
      }
    })

    const idInicial = precioProdId ?? [...resumenProd.values()].sort((a, b) => b.pct - a.pct)[0]?.id ?? data.productos[0]?.id
    return { resumenProd, porCategoria, seleccionado: resumenProd.get(idInicial) ?? null }
  }, [base, data, precioProdId])

  const cabecera = (
    <PageHeader title="Reportes" subtitle="Retiros, compras, stock, desviación y variación de precios. Puedes descargarlos en Excel o imprimirlos."
      actions={<button type="button" className="btn btn--secondary" onClick={() => window.print()}><Printer size={20} /> Imprimir / PDF</button>} />
  )
  if (loading && !base) return <>{cabecera}<Estado cargando /></>
  if (error && !base) return <>{cabecera}<Estado error={error} /></>

  const nombre = (id) => base.usu.get(id)?.nombre_completo ?? '—'
  const csv = (archivo, cols, filas) => descargarCSV(`${archivo}_${periodo}dias.csv`, cols, filas)
  const conPeriodo = tab !== 'stock' && tab !== 'precios'
  const conPersona = tab === 'retiros' || tab === 'compras'

  const elegirInsumoPrecio = (p) => {
    setPrecioProdId(p.id)
    setTimeout(() => detallePrecioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
  }

  return (
    <>
      {cabecera}
      <div className="print-head">
        <b>Reporte de {TABS.find((t) => t.id === tab).label.toLowerCase()} · Agrícola Moncopulli</b>
        <span>{conPeriodo ? periodoTxt : tab === 'precios' ? 'Historial de variación de precios (últimos 3 meses)' : 'Estado actual del stock'} · Generado el {dmy(new Date())} {hm(new Date())} por {usuario.nombre_completo}</span>
      </div>

      <div className="report-bar">
        <div className="segmented segmented--scroll" role="tablist" aria-label="Tipo de reporte">
          {TABS.map((t) => (
            <button type="button" role="tab" aria-selected={tab === t.id} key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}><t.icon size={20} /> {t.label}</button>
          ))}
        </div>
        <div className="report-bar__filters">
          {conPeriodo && <Select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}
          {conPersona && (
            <Select aria-label="Persona" value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="">Todas las personas</option>
              {data.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
            </Select>
          )}
          {tab === 'stock' && (
            <Select aria-label="Categoría" value={catStock} onChange={(e) => setCatStock(e.target.value)}>
              <option value="">Todas las categorías</option>
              {[...new Set(data.productos.map((p) => p.categoria))].sort().map((c) => <option key={c}>{c}</option>)}
            </Select>
          )}
        </div>
      </div>

      {tab === 'retiros' && (
        <>
          <div className="stats stats--3">
            <StatCard icon={ArrowUpRight} tone="warning" label="Retiros" value={ret.lista.length} note={`${ret.porInsumo.length} insumos distintos`} />
            <StatCard icon={Wallet} tone="neutral" label="Valor estimado" value={pesos(ret.valorTotal)} note="A costo promedio en el período" />
            <StatCard icon={CalendarClock} tone="primary" label="Gasto semanal promedio" value={pesos(ret.gastoSemanal)} note={`Promedio diario: ${pesos(ret.gastoDiario)}`} />
            <StatCard icon={Wallet} tone="primary" label="Gasto mensual promedio" value={pesos(ret.gastoMensual)} note="Proyección mensual (30 días)" />
            <StatCard icon={Users} tone="neutral" label="Personas que retiraron" value={ret.personas} note={persona ? nombre(Number(persona)) : 'En el período'} />
            <StatCard icon={Package} tone="neutral" label="Insumo más retirado" value={masRetirado?.p?.nombre ?? '—'} note={masRetirado ? `${masRetirado.retiros} retiros · ${pesos(masRetirado.valor)}` : 'Sin retiros'} />
          </div>

          <Seccion titulo="Retiros por trabajador" nota={periodoTxt}
            accion={<LinkButton icon={Download} onClick={() => csv('retiros_por_trabajador', [
              { titulo: 'Trabajador', valor: (t) => t.nombre }, { titulo: 'Puesto', valor: (t) => t.puesto }, { titulo: 'Retiros', valor: (t) => t.retiros },
              { titulo: 'Insumos distintos', valor: (t) => t.insumos }, { titulo: 'Insumo más retirado', valor: (t) => t.masRetirado },
              { titulo: 'Valor estimado', valor: (t) => Math.round(t.valor) }, { titulo: 'Último retiro', valor: (t) => `${dmy(t.ultimo)} ${hm(t.ultimo)}` },
            ], ret.trabajadores)}>Descargar Excel</LinkButton>}>
            <Tabla columnas={[{ t: 'Trabajador' }, { t: 'Retiros', r: 1 }, { t: 'Insumos distintos', r: 1 }, { t: 'Más retirado' }, { t: 'Valor estimado', r: 1 }, { t: 'Último retiro', n: 1 }]}
              vacio="Nadie retiró insumos en este período."
              filas={ret.trabajadores.map((t) => [<><b>{t.nombre}</b><div className="sub">{t.puesto}</div></>, t.retiros, t.insumos, t.masRetirado, pesos(t.valor), `${dmy(t.ultimo)} ${hm(t.ultimo)}`])} />
          </Seccion>

          <GraficoCard titulo="Consumo de un insumo en el tiempo" nota={serieProducto ? `${serieProducto.semanal ? 'Total por semana' : 'Total por día'} · ${periodoTxt}` : ''}
            accion={
              <Select aria-label="Insumo" value={productoSel ?? ''} onChange={(e) => setProductoId(e.target.value)}>
                {[...data.productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>}
            vacio={!serieProducto && 'No hay retiros en este período.'}
            tabla={serieProducto && { columnas: [serieProducto.semanal ? 'Semana del' : 'Día', 'Cantidad'], filas: [...serieProducto.serie].reverse().map((d) => [dmy(d.fecha), `${num(d.valor)} ${base.prod.get(productoSel)?.unidad_medida ?? ''}`]) }}>
            {serieProducto && (
              <>
                <div className="mini-stats">
                  <div><span>Total retirado</span><b>{num(serieProducto.total)} {base.prod.get(productoSel)?.unidad_medida}</b></div>
                  <div><span>Retiros</span><b>{serieProducto.retiros}</b></div>
                  <div><span>Promedio por día</span><b>{num(serieProducto.porDia)} {base.prod.get(productoSel)?.unidad_medida}</b></div>
                </div>
                <ColumnChart datos={serieProducto.serie} unidad={base.prod.get(productoSel)?.unidad_medida ?? ''} semanal={serieProducto.semanal} />
              </>
            )}
          </GraficoCard>

          <GraficoCard titulo="Consumo por insumo" nota="Valor estimado a costo promedio."
            accion={<LinkButton icon={Download} onClick={() => csv('retiros', [
              { titulo: 'Fecha', valor: (c) => dmy(fechaConsumo(c)) }, { titulo: 'Hora', valor: (c) => hm(fechaConsumo(c)) },
              { titulo: 'Código', valor: (c) => base.prod.get(c.producto)?.codigo }, { titulo: 'Insumo', valor: (c) => base.prod.get(c.producto)?.nombre },
              { titulo: 'Cantidad', valor: (c) => num(c.cantidad_retirada) }, { titulo: 'Unidad', valor: (c) => base.prod.get(c.producto)?.unidad_medida },
              { titulo: 'Retirado por', valor: (c) => nombre(c.usuario) }, { titulo: 'Bodega', valor: (c) => base.bod.get(c.bodega)?.nombre },
            ], [...ret.lista].sort((a, b) => fechaConsumo(b) - fechaConsumo(a)))}>Descargar todos los retiros</LinkButton>}
            vacio={ret.porInsumo.length === 0 && 'No hay retiros en este período.'}
            tabla={{ columnas: ['Insumo', 'Retiros', 'Cantidad', 'Valor estimado'], filas: ret.porInsumo.map((c) => [c.p?.nombre ?? 'Insumo', c.retiros, `${num(c.cantidad)} ${c.p?.unidad_medida ?? ''}`, pesos(c.valor)]) }}>
            <BarList items={ret.porInsumo.slice(0, 8).map((c) => ({ key: c.id, label: c.p?.nombre ?? 'Insumo', texto: pesos(c.valor), valor: c.valor, detalle: `${c.retiros} ${c.retiros === 1 ? 'retiro' : 'retiros'} · ${num(c.cantidad)} ${c.p?.unidad_medida ?? ''}` }))} />
          </GraficoCard>
        </>
      )}

      {tab === 'compras' && (
        <>
          <div className="stats stats--4">
            <StatCard icon={ShoppingCart} label="Compras" value={com.docs.length} note={`${com.porProv.length} ${com.porProv.length === 1 ? 'proveedor' : 'proveedores'}`} />
            <StatCard icon={Wallet} tone="neutral" label="Total comprado" value={pesos(com.total)} note="Cantidad × precio unitario" />
            <StatCard icon={Scale} tone="neutral" label="Compra promedio" value={pesos(com.docs.length ? com.total / com.docs.length : 0)} note="Por documento" />
            <StatCard icon={Truck} tone="primary" label="Proveedor principal" value={com.provPrincipal?.nombre ?? '—'}
              note={com.provPrincipal ? `${com.pctProv}% del gasto (${pesos(com.provPrincipal.total)})` : 'Sin compras en el período'} />
          </div>

          <Seccion titulo="Compras por trabajador" nota={periodoTxt}
            accion={<LinkButton icon={Download} onClick={() => csv('compras_por_trabajador', [
              { titulo: 'Trabajador', valor: (t) => t.nombre }, { titulo: 'Compras', valor: (t) => t.compras }, { titulo: 'Total', valor: (t) => Math.round(t.total) }, { titulo: 'Última compra', valor: (t) => dmy(t.ultima) },
            ], com.trabajadores)}>Descargar Excel</LinkButton>}>
            <Tabla columnas={[{ t: 'Trabajador' }, { t: 'Compras', r: 1 }, { t: 'Total', r: 1 }, { t: 'Última compra', n: 1 }]} vacio="No hay compras en este período."
              filas={com.trabajadores.map((t) => [<><b>{t.nombre}</b><div className="sub">{t.puesto}</div></>, t.compras, pesos(t.total), dmy(t.ultima)])} />
          </Seccion>

          <div className="grid-2">
            <GraficoCard titulo={com.semanal ? 'Gasto por semana' : 'Gasto por día'} nota="Total de los documentos de compra."
              vacio={com.docs.length === 0 && 'No hay compras en este período.'}
              tabla={{ columnas: [com.semanal ? 'Semana del' : 'Día', 'Total'], filas: [...(com.semanal ? agruparSemanas(com.gasto) : com.gasto)].reverse().map((d) => [dmy(d.fecha), pesos(d.valor)]) }}>
              <ColumnChart datos={com.semanal ? agruparSemanas(com.gasto) : com.gasto} unidad="$" semanal={com.semanal} />
            </GraficoCard>
            <GraficoCard titulo="Compras por proveedor" nota="Total en pesos."
              vacio={com.porProv.length === 0 && 'No hay compras en este período.'}
              tabla={{ columnas: ['Proveedor', 'Documentos', 'Total'], filas: com.porProv.map((c) => [c.nombre, c.n, pesos(c.total)]) }}>
              <BarList items={com.porProv.slice(0, 8).map((c) => ({ key: c.id, label: c.nombre, texto: pesos(c.total), valor: c.total, detalle: `${c.n} ${c.n === 1 ? 'documento' : 'documentos'}` }))} />
            </GraficoCard>
          </div>

          <Seccion titulo="Documentos de compra" nota={`${com.docs.length} en el período`}
            accion={<LinkButton icon={Download} onClick={() => csv('compras', [
              { titulo: 'Fecha', valor: (d) => dmy(d.fecha) }, { titulo: 'Documento', valor: (d) => `${d.tipo_documento} ${d.numero_folio}` }, { titulo: 'Proveedor', valor: (d) => base.prov.get(d.proveedor)?.nombre },
              { titulo: 'Bodega', valor: (d) => base.bod.get(d.bodega)?.nombre }, { titulo: 'Registrada por', valor: (d) => nombre(d.usuario) },
              { titulo: 'Insumos', valor: (d) => d.lineas.map((l) => `${base.prod.get(l.producto)?.nombre} (${num(l.cantidad)})`).join(' | ') }, { titulo: 'Total', valor: (d) => Math.round(d.total) },
            ], com.docs)}>Descargar Excel</LinkButton>}>
            <Tabla columnas={[{ t: 'Fecha', n: 1 }, { t: 'Documento' }, { t: 'Proveedor' }, { t: 'Bodega' }, { t: 'Registró' }, { t: 'Total', r: 1 }]} vacio="No hay compras en este período."
              filas={com.docs.slice(0, 50).map((d) => [dmy(d.fecha), `${d.tipo_documento} N° ${d.numero_folio}`, base.prov.get(d.proveedor)?.nombre, base.bod.get(d.bodega)?.nombre, nombre(d.usuario), pesos(d.total)])} />
            {com.docs.length > 50 && <p className="sub report-note">Se muestran los 50 más recientes. El archivo de Excel incluye todos.</p>}
          </Seccion>
        </>
      )}

      {tab === 'stock' && (
        <>
          <div className="stats stats--4">
            <StatCard icon={Wallet} tone="neutral" label="Valor del inventario" value={pesos(stock.valor)} note="Stock × costo promedio" />
            <StatCard icon={TriangleAlert} tone="warning" label="Stock bajo" value={stock.bajo} note="Por debajo del mínimo" />
            <StatCard icon={Package} tone="danger" label="Sin stock" value={stock.sin} note="Agotados" />
            <StatCard icon={Hourglass} tone="warning" label="Alcanzan menos de 15 días" value={stock.pocos} note="Al ritmo de los últimos 30 días" />
          </div>
          <Seccion titulo="Stock por bodega" nota="Ordenado: primero lo más urgente."
            accion={<LinkButton icon={Download} onClick={() => descargarCSV('stock.csv', [
              { titulo: 'Código', valor: (f) => f.p.codigo }, { titulo: 'Insumo', valor: (f) => f.p.nombre }, { titulo: 'Categoría', valor: (f) => f.p.categoria }, { titulo: 'Unidad', valor: (f) => f.p.unidad_medida },
              { titulo: 'Total', valor: (f) => num(f.p.stock_actual) }, ...data.bodegas.map((b) => ({ titulo: b.nombre, valor: (f) => num(stockEn(f.p, b.id)) })),
              { titulo: 'Mínimo', valor: (f) => num(f.p.stock_minimo) }, { titulo: 'Alcanza para (días)', valor: (f) => (f.dias == null ? '' : Math.floor(f.dias)) },
              { titulo: 'Valor', valor: (f) => Math.round(f.valor) }, { titulo: 'Estado', valor: (f) => ESTADO_STOCK[f.e].label },
            ], stock.filas)}>Descargar Excel</LinkButton>}>
            <Tabla clase="table--wide" columnas={[{ t: 'Insumo' }, { t: 'Total', r: 1 }, ...data.bodegas.filter((b) => b.estado !== false).map((b) => ({ t: b.nombre, r: 1 })), { t: 'Mínimo', r: 1 }, { t: 'Alcanza para', n: 1 }, { t: 'Valor', r: 1 }, { t: 'Estado' }]}
              filas={stock.filas.map((f) => [
                <><b>{f.p.nombre}</b><div className="sub">{f.p.codigo} · {f.p.categoria}</div></>,
                <b>{num(f.p.stock_actual)} {f.p.unidad_medida}</b>,
                ...data.bodegas.filter((b) => b.estado !== false).map((b) => { const v = stockEn(f.p, b.id); return v ? num(v) : '—' }),
                `${num(f.p.stock_minimo)}`,
                Number(f.p.stock_actual) <= 0 ? 'Agotado' : f.dias == null ? 'Sin consumo' : f.dias < 1 ? 'Menos de 1 día' : `${Math.floor(f.dias)} días`,
                pesos(f.valor), <Badge tone={ESTADO_STOCK[f.e].tone}>{ESTADO_STOCK[f.e].label}</Badge>])} />
          </Seccion>
        </>
      )}

      {tab === 'desviacion' && (
        <>
          <div className="stats stats--4">
            <StatCard icon={ClipboardList} tone="neutral" label="Inventarios realizados" value={des.porInv.length} note={periodoTxt} />
            <StatCard icon={Scale} tone={Math.abs(des.pct) > 2 ? 'warning' : 'primary'} label="Desviación total" value={`${des.pct.toFixed(1).replace('.', ',')} %`} note="(Real − sistema) ÷ sistema" />
            <StatCard icon={Wallet} tone={des.valor < 0 ? 'danger' : 'neutral'} label="Diferencia valorizada" value={pesos(des.valor)} note={des.valor < 0 ? 'Faltante respecto al sistema' : 'Sobrante respecto al sistema'} />
            <StatCard icon={Package} tone="neutral" label="Insumos con diferencia" value={des.conDif} note="Contado ≠ sistema" />
          </div>

          <Seccion titulo="Inventarios del período" nota="Cada conteo físico contra lo que decía el sistema."
            accion={<LinkButton icon={Download} onClick={() => csv('desviacion', [
              { titulo: 'Fecha', valor: (x) => dmy(parseDate(x.i.fecha)) }, { titulo: 'Bodega', valor: (x) => base.bod.get(x.i.bodega)?.nombre }, { titulo: 'Registró', valor: (x) => nombre(x.i.usuario) },
              { titulo: 'Insumos contados', valor: (x) => x.n }, { titulo: 'Insumos con diferencia', valor: (x) => x.conDif }, { titulo: 'Desviación %', valor: (x) => x.pct.toFixed(2).replace('.', ',') }, { titulo: 'Diferencia $', valor: (x) => Math.round(x.valor) },
            ], des.porInv)}>Descargar Excel</LinkButton>}>
            <Tabla columnas={[{ t: 'Fecha', n: 1 }, { t: 'Bodega' }, { t: 'Registró' }, { t: 'Contados', r: 1 }, { t: 'Con diferencia', r: 1 }, { t: 'Desviación', r: 1 }, { t: 'Diferencia $', r: 1 }]} vacio="No hay inventarios en este período."
              filas={des.porInv.map((x) => [dmy(parseDate(x.i.fecha)), base.bod.get(x.i.bodega)?.nombre, nombre(x.i.usuario), x.n, x.conDif,
                <b className={x.pct < 0 ? 'diff--neg' : ''}>{x.pct.toFixed(1).replace('.', ',')} %</b>, <span className={x.valor < 0 ? 'diff--neg' : ''}>{pesos(x.valor)}</span>])} />
          </Seccion>

          <GraficoCard titulo="Insumos con más diferencia" nota="Diferencia valorizada a costo promedio (negativo = faltante)."
            vacio={des.porProd.length === 0 && 'Los conteos coinciden con el sistema.'}
            tabla={{ columnas: ['Insumo', 'Veces contado', 'Sistema', 'Real', 'Diferencia', 'Valor'], filas: des.porProd.map((x) => [x.p?.nombre, x.veces, num(x.sis), num(x.real), signo(x.dif), pesos(x.valor)]) }}>
            <BarList items={des.porProd.slice(0, 8).map((x) => ({ key: x.id, label: x.p?.nombre ?? 'Insumo', texto: `${x.valor < 0 ? '−' : '+'}${pesos(Math.abs(x.valor))}`, valor: Math.abs(x.valor), detalle: `Diferencia ${signo(x.dif)} ${x.p?.unidad_medida ?? ''} (sistema ${num(x.sis)} · real ${num(x.real)})` }))} />
          </GraficoCard>
        </>
      )}

      {tab === 'precios' && precios && (
        <>
          <div className="stats stats--4">
            {precios.porCategoria.map((c) => (
              <StatCard
                key={c.categoria}
                icon={TrendingUp}
                tone={c.pct > 5 ? 'warning' : 'primary'}
                label={`Variación en ${c.categoria}`}
                value={fmtPct(c.pct)}
                note={c.mayor ? `Últimos 3 meses · Mayor: ${c.mayor.producto?.nombre} (${fmtPct(c.mayor.pct)})` : 'Últimos 3 meses'}
              />
            ))}
          </div>

          <div ref={detallePrecioRef}>
            {precios.seleccionado && (
              <>
                <GraficoCard
                  titulo={`Evolución de precio: ${precios.seleccionado.producto.nombre} (${precios.seleccionado.producto.codigo})`}
                  nota={`Precio unitario por ${precios.seleccionado.producto.unidad_medida} en cada compra registrada (${precios.seleccionado.compras} ${precios.seleccionado.compras === 1 ? 'compra' : 'compras'})`}
                  accion={
                    <LinkButton icon={Download} onClick={() => descargarCSV(`precios_${precios.seleccionado.producto.codigo}.csv`, [
                      { titulo: 'Fecha', valor: (x) => dmy(x.fecha) },
                      { titulo: 'Documento', valor: (x) => `${x.tipo} ${x.folio}` },
                      { titulo: 'Proveedor', valor: (x) => x.proveedor },
                      { titulo: 'Cantidad', valor: (x) => num(x.cantidad) },
                      { titulo: 'Unidad', valor: () => precios.seleccionado.producto.unidad_medida },
                      { titulo: 'Precio unitario', valor: (x) => x.precio },
                      { titulo: 'Variación % vs anterior', valor: (x) => (x.diffPct == null ? '' : x.diffPct.toFixed(2).replace('.', ',')) },
                    ], precios.seleccionado.puntos)}>
                      Descargar historial
                    </LinkButton>
                  }
                  vacio={precios.seleccionado.puntos.length === 0 && 'Este insumo aún no registra compras históricas.'}
                  tabla={{
                    columnas: ['Fecha', 'Documento', 'Proveedor', 'Cantidad', 'Precio unitario', 'Variación vs anterior'],
                    filas: precios.seleccionado.puntos.map((x) => [
                      dmy(x.fecha),
                      `${x.tipo} N° ${x.folio}`,
                      x.proveedor,
                      `${num(x.cantidad)} ${precios.seleccionado.producto.unidad_medida}`,
                      pesos(x.precio),
                      x.diffPct == null ? '1ª compra' : `${fmtPct(x.diffPct)} (${x.diffPesos >= 0 ? '+' : '−'}${pesos(Math.abs(x.diffPesos))})`,
                    ]),
                  }}
                >
                  <div className="mini-stats mini-stats--4">
                    <div>
                      <span>Primer precio registrado</span>
                      <b>{pesos(precios.seleccionado.primero)}</b>
                      {precios.seleccionado.fechaPrimero && <small className="sub">{dmy(precios.seleccionado.fechaPrimero)}</small>}
                    </div>
                    <div>
                      <span>Último precio pagado</span>
                      <b>{pesos(precios.seleccionado.ultimo)}</b>
                      {precios.seleccionado.fechaUltimo && <small className="sub">{dmy(precios.seleccionado.fechaUltimo)}</small>}
                    </div>
                    <div>
                      <span>Variación acumulada</span>
                      <b className={precios.seleccionado.pct > 0 ? 'diff--neg' : ''}>
                        {fmtPct(precios.seleccionado.pct)} ({precios.seleccionado.diff >= 0 ? '+' : '−'}{pesos(Math.abs(precios.seleccionado.diff))})
                      </b>
                      <small className="sub">Entre primera y última compra</small>
                    </div>
                    <div>
                      <span>Costo promedio actual</span>
                      <b>{pesos(precios.seleccionado.producto.costo_promedio)} / {precios.seleccionado.producto.unidad_medida}</b>
                      <small className="sub">{precios.seleccionado.compras} {precios.seleccionado.compras === 1 ? 'compra registrada' : 'compras registradas'}</small>
                    </div>
                  </div>
                  <LineChart datos={precios.seleccionado.puntos} unidad={precios.seleccionado.producto.unidad_medida} />
                </GraficoCard>

                <Seccion
                  titulo={`Compras históricas de ${precios.seleccionado.producto.nombre}`}
                  nota="Comparación del precio unitario pagado en cada documento de compra."
                >
                  <Tabla
                    columnas={[
                      { t: 'Fecha', n: 1 },
                      { t: 'Documento' },
                      { t: 'Proveedor' },
                      { t: 'Cantidad', r: 1 },
                      { t: 'Precio unitario', r: 1 },
                      { t: 'Variación vs compra anterior', r: 1 },
                      { t: 'Subtotal línea', r: 1 },
                    ]}
                    vacio="Sin compras registradas para este insumo."
                    filas={[...precios.seleccionado.puntos].reverse().map((x) => [
                      dmy(x.fecha),
                      `${x.tipo} N° ${x.folio}`,
                      x.proveedor,
                      `${num(x.cantidad)} ${precios.seleccionado.producto.unidad_medida}`,
                      <b>{pesos(x.precio)}</b>,
                      x.diffPct == null
                        ? <span className="sub">Primera compra</span>
                        : <b className={x.diffPct > 0 ? 'diff--neg' : ''}>{fmtPct(x.diffPct)} ({x.diffPesos >= 0 ? '+' : '−'}{pesos(Math.abs(x.diffPesos))})</b>,
                      pesos(x.cantidad * x.precio),
                    ])}
                  />
                </Seccion>
              </>
            )}
          </div>

          <section className="card consumo__lista report-card" aria-label="Productos">
            <div>
              <h2>Productos ({data.productos.length})</h2>
              <p className="sub">Toca cualquier bloque para ver su gráfico de compras históricas y cómo ha variado su precio unitario.</p>
            </div>
            <ProductoPicker
              productos={data.productos}
              onSelect={elegirInsumoPrecio}
              seleccionadoId={precios.seleccionado?.id}
              renderDetalle={(p) => {
                const info = precios.resumenProd.get(p.id)
                if (!info) return <><b>{pesos(p.costo_promedio)}</b> / {p.unidad_medida}</>
                return (
                  <>
                    <b>{pesos(info.ultimo)}</b> / {p.unidad_medida}
                    <em className={info.pct > 0 ? 'pcard__var--up' : info.pct < 0 ? 'pcard__var--down' : ''}>
                      {fmtPct(info.pct)}
                    </em>
                  </>
                )
              }}
            />
          </section>
        </>
      )}
    </>
  )
}
