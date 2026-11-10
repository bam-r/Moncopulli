import { useMemo, useState } from 'react'
import { ArrowUpRight, Droplets, Plus, ShoppingCart } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { Badge, Estado, LinkButton, PageHeader, Select, StatCard } from '../components/ui'
import { BarList, ColumnChart, GraficoCard } from '../components/charts'
import { AnularConsumoModal, LecheModal } from '../components/modals-extra'
import { descargarCSV } from '../lib/csv'
import { dmy, esAnulado, hm, miles, num, parseDate, pesos } from '../lib/format'

const RECURSOS = ['consumos', 'productos', 'usuarios', 'bodegas', 'proveedores', 'documentos-compra', 'detalle-documentos', 'produccion-leche']
const PERIODOS = { '7': 'Últimos 7 días', '30': 'Últimos 30 días', mes: 'Este mes', todo: 'Todo el historial' }

function desde(periodo) {
  const h = new Date(); h.setHours(0, 0, 0, 0)
  if (periodo === 'todo') return new Date(0)
  if (periodo === 'mes') return new Date(h.getFullYear(), h.getMonth(), 1)
  h.setDate(h.getDate() - (Number(periodo) - 1))
  return h
}

export default function Reportes() {
  const { usuario } = useAuth()
  const { data, loading, error, reload } = useRecursos(RECURSOS)
  const [periodo, setPeriodo] = useState('30')
  const [modal, setModal] = useState(false)
  const [consumoAnular, setConsumoAnular] = useState(null)

  const r = useMemo(() => {
    if (!data.consumos) return null
    const ini = desde(periodo)
    const prod = new Map(data.productos.map((p) => [p.id, p]))
    const usu = new Map(data.usuarios.map((u) => [u.id, u]))
    const bod = new Map(data.bodegas.map((b) => [b.id, b]))
    const prov = new Map(data.proveedores.map((p) => [p.id, p]))
    const docs = new Map(data['documentos-compra'].map((d) => [d.id, d]))

    const registrosConsumo = data.consumos.filter((c) => parseDate(c.fecha) >= ini).sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha))
    const consumos = registrosConsumo.filter((c) => !esAnulado(c))
    const porInsumo = new Map()
    consumos.forEach((c) => {
      const p = prod.get(c.producto)
      const x = porInsumo.get(c.producto) ?? { key: c.producto, p, retiros: 0, cantidad: 0, valor: 0 }
      x.retiros += 1; x.cantidad += Number(c.cantidad_retirada); x.valor += Number(c.cantidad_retirada) * Number(p?.costo_promedio ?? 0)
      porInsumo.set(c.producto, x)
    })
    const consumo = [...porInsumo.values()].sort((a, b) => b.valor - a.valor)

    const lineas = data['detalle-documentos'].filter((d) => docs.has(d.documento) && parseDate(docs.get(d.documento).fecha_emision) >= ini)
    const porProv = new Map()
    const docsUsados = new Set()
    lineas.forEach((l) => {
      const doc = docs.get(l.documento); docsUsados.add(doc.id)
      const x = porProv.get(doc.proveedor) ?? { key: doc.proveedor, nombre: prov.get(doc.proveedor)?.nombre ?? 'Proveedor', valor: 0, docs: new Set() }
      x.valor += Number(l.cantidad) * Number(l.precio_unitario); x.docs.add(doc.id)
      porProv.set(doc.proveedor, x)
    })
    const compras = [...porProv.values()].sort((a, b) => b.valor - a.valor)

    const porDia = new Map()
    data['produccion-leche'].filter((l) => parseDate(l.fecha) >= ini).forEach((l) => {
      const f = parseDate(l.fecha); const k = f.getTime()
      porDia.set(k, { fecha: f, valor: (porDia.get(k)?.valor ?? 0) + Number(l.litros) })
    })
    const leche = [...porDia.values()].sort((a, b) => a.fecha - b.fecha)

    return { consumos, registrosConsumo, consumo, compras, lineas, docsUsados, leche, prod, usu, bod, prov, docs,
      totalCompras: compras.reduce((s, c) => s + c.valor, 0), totalLeche: leche.reduce((s, d) => s + d.valor, 0) }
  }, [data, periodo])

  const filtro = <Select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
  const cabecera = <PageHeader title="Reportes" subtitle="Consumos, compras y producción de leche del período." actions={filtro} />
  if (loading && !data.consumos) return <>{cabecera}<Estado cargando /></>
  if (error && !data.consumos) return <>{cabecera}<Estado error={error} /></>

  const exportarConsumos = () => descargarCSV(`consumos_${periodo}.csv`, [
    { titulo: 'Fecha', valor: (c) => dmy(parseDate(c.fecha)) }, { titulo: 'Hora', valor: (c) => hm(parseDate(c.fecha)) },
    { titulo: 'Código', valor: (c) => r.prod.get(c.producto)?.codigo }, { titulo: 'Insumo', valor: (c) => r.prod.get(c.producto)?.nombre },
    { titulo: 'Cantidad', valor: (c) => num(c.cantidad_retirada) }, { titulo: 'Unidad', valor: (c) => r.prod.get(c.producto)?.unidad_medida },
    { titulo: 'Retirado por', valor: (c) => r.usu.get(c.usuario)?.nombre_completo }, { titulo: 'Bodega', valor: (c) => r.bod.get(c.bodega)?.nombre },
  ], r.consumos)
  const exportarCompras = () => descargarCSV(`compras_${periodo}.csv`, [
    { titulo: 'Fecha', valor: (l) => dmy(parseDate(r.docs.get(l.documento).fecha_emision)) }, { titulo: 'Documento', valor: (l) => `${r.docs.get(l.documento).tipo_documento} ${r.docs.get(l.documento).numero_folio}` },
    { titulo: 'Proveedor', valor: (l) => r.prov.get(r.docs.get(l.documento).proveedor)?.nombre }, { titulo: 'Código', valor: (l) => r.prod.get(l.producto)?.codigo },
    { titulo: 'Insumo', valor: (l) => r.prod.get(l.producto)?.nombre }, { titulo: 'Cantidad', valor: (l) => num(l.cantidad) },
    { titulo: 'Precio unitario', valor: (l) => l.precio_unitario }, { titulo: 'Total', valor: (l) => Math.round(Number(l.cantidad) * Number(l.precio_unitario)) },
  ], r.lineas)

  const promedio = r.leche.length ? r.totalLeche / r.leche.length : 0

  return (
    <>
      {cabecera}
      <div className="stats stats--3">
        <StatCard icon={ArrowUpRight} tone="warning" label="Retiros registrados" value={r.consumos.length} note={`${r.consumo.length} insumos distintos`} />
        <StatCard icon={ShoppingCart} label="Compras" value={pesos(r.totalCompras)} note={`${r.docsUsados.size} ${r.docsUsados.size === 1 ? 'documento' : 'documentos'}`} />
        <StatCard icon={Droplets} tone="neutral" label="Leche producida" value={`${miles(r.totalLeche)} L`} note={r.leche.length ? `Promedio ${miles(promedio)} L/día` : 'Sin registros'} />
      </div>

      <section className="card table-card report-consumptions">
        <div className="card__head">
          <div><h2>Consumos del período</h2><p className="sub">Puedes anular un registro incorrecto; se conservará el motivo.</p></div>
        </div>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>Fecha</th><th>Trabajador</th><th>Insumo</th><th className="right">Cantidad</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {r.registrosConsumo.length === 0 && <tr><td colSpan={6} className="empty">No hay consumos en este período.</td></tr>}
              {r.registrosConsumo.map((c) => {
                const anulado = esAnulado(c)
                const producto = r.prod.get(c.producto)
                const descripcion = `${r.usu.get(c.usuario)?.nombre_completo ?? 'Trabajador'} retiró ${num(c.cantidad_retirada)} ${producto?.unidad_medida ?? ''} de ${producto?.nombre ?? 'insumo'}`
                return (
                  <tr key={c.id} className={anulado ? 'row--muted' : ''}>
                    <td className="nowrap">{`${dmy(parseDate(c.fecha))} ${hm(parseDate(c.fecha))}`}</td>
                    <td>{r.usu.get(c.usuario)?.nombre_completo ?? '—'}</td>
                    <td>{producto?.nombre ?? '—'}</td>
                    <td className="right nowrap">{num(c.cantidad_retirada)} {producto?.unidad_medida}</td>
                    <td><Badge tone={anulado ? 'danger' : 'success'}>{anulado ? 'Anulado' : 'Confirmado'}</Badge>{anulado && c.motivo_anulacion && <div className="sub">{c.motivo_anulacion}</div>}</td>
                    <td className="right">{!anulado && <button type="button" className="link-btn link-btn--danger" onClick={() => setConsumoAnular({ consumo: c, descripcion })}>Anular</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <GraficoCard titulo="Consumo por insumo" nota="Valor estimado a costo promedio."
          accion={<LinkButton onClick={exportarConsumos}>Exportar CSV</LinkButton>}
          vacio={r.consumo.length === 0 && 'No hay retiros en este período.'}
          tabla={{ columnas: ['Insumo', 'Retiros', 'Cantidad', 'Valor estimado'], filas: r.consumo.map((c) => [c.p?.nombre ?? 'Insumo', c.retiros, `${num(c.cantidad)} ${c.p?.unidad_medida ?? ''}`, pesos(c.valor)]) }}>
          <BarList items={r.consumo.slice(0, 7).map((c) => ({ key: c.key, label: c.p?.nombre ?? 'Insumo', texto: pesos(c.valor), valor: c.valor, detalle: `${c.retiros} ${c.retiros === 1 ? 'retiro' : 'retiros'} · ${num(c.cantidad)} ${c.p?.unidad_medida ?? ''}` }))} />
        </GraficoCard>

        <GraficoCard titulo="Compras por proveedor" nota="Suma de cantidad × precio unitario de cada documento."
          accion={<LinkButton onClick={exportarCompras}>Exportar CSV</LinkButton>}
          vacio={r.compras.length === 0 && 'No hay compras en este período.'}
          tabla={{ columnas: ['Proveedor', 'Documentos', 'Total'], filas: r.compras.map((c) => [c.nombre, c.docs.size, pesos(c.valor)]) }}>
          <BarList items={r.compras.slice(0, 7).map((c) => ({ key: c.key, label: c.nombre, texto: pesos(c.valor), valor: c.valor, detalle: `${c.docs.size} ${c.docs.size === 1 ? 'documento' : 'documentos'}` }))} />
        </GraficoCard>
      </div>

      <GraficoCard titulo="Producción de leche" nota="Litros por día."
        accion={<LinkButton icon={Plus} onClick={() => setModal(true)}>Registrar producción</LinkButton>}
        vacio={r.leche.length === 0 && 'No hay producción registrada en este período.'}
        tabla={{ columnas: ['Fecha', 'Litros'], filas: [...r.leche].reverse().map((d) => [dmy(d.fecha), `${num(d.valor)} L`]) }}>
        <ColumnChart datos={r.leche} unidad="L" />
      </GraficoCard>

      {modal && <LecheModal usuario={usuario} onClose={() => setModal(false)} onSaved={reload} />}
      {consumoAnular && <AnularConsumoModal consumo={consumoAnular.consumo} descripcion={consumoAnular.descripcion} usuario={usuario} onClose={() => setConsumoAnular(null)} onSaved={reload} />}
    </>
  )
}
