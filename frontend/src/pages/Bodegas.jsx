import { useMemo, useState } from 'react'
import { Search, Settings, TriangleAlert, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRecursos } from '../api/hooks'
import { Badge, Estado, PageHeader } from '../components/ui'
import { ESTADO_STOCK, estadoStock } from '../lib/stock'
import { num, pesos } from '../lib/format'
import { sinTildes, stockEn } from '../lib/analisis'

export default function Bodegas() {
  const { data, loading, error } = useRecursos(['productos', 'bodegas'])
  const [elegida, setElegida] = useState(null)
  const [q, setQ] = useState('')

  const bodegas = data.bodegas ?? []
  const productos = data.productos ?? []
  const resumen = useMemo(() => bodegas.map((b) => {
    const items = productos.map((p) => ({ p, hay: stockEn(p, b.id) })).filter((x) => x.hay > 0)
    return { b, items, valor: items.reduce((s, x) => s + x.hay * Number(x.p.costo_promedio), 0), bajos: items.filter((x) => estadoStock(x.p) !== 'ok').length }
  }), [bodegas, productos])

  const cabecera = <PageHeader title="Bodegas" subtitle="Cuánto hay de cada insumo en cada bodega." actions={<Link className="btn btn--secondary" to="/configuracion"><Settings size={20} /> Administrar bodegas</Link>} />
  if (loading && !data.bodegas) return <>{cabecera}<Estado cargando /></>
  if (error && !data.bodegas) return <>{cabecera}<Estado error={error} /></>

  const activa = resumen.find((r) => r.b.id === elegida) ?? resumen.find((r) => r.b.estado !== false) ?? resumen[0]
  const t = sinTildes(q).trim()
  const filas = (activa?.items ?? []).filter((x) => !t || sinTildes(`${x.p.nombre} ${x.p.codigo} ${x.p.categoria}`).includes(t)).sort((a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es'))

  return (
    <>
      {cabecera}
      <div className="bodega-cards" role="tablist" aria-label="Bodegas">
        {resumen.map(({ b, items, valor, bajos }) => (
          <button type="button" role="tab" aria-selected={activa?.b.id === b.id} key={b.id} className={`bodega-card ${activa?.b.id === b.id ? 'bodega-card--on' : ''}`} onClick={() => { setElegida(b.id); setQ('') }}>
            <span className="bodega-card__head"><Warehouse size={26} /><b>{b.nombre}</b>{b.estado === false && <Badge tone="danger">Inactiva</Badge>}</span>
            <span className="bodega-card__loc">{b.ubicacion}</span>
            <span className="bodega-card__nums">
              <span><b>{items.length}</b> insumos</span>
              <span><b>{pesos(valor)}</b> en stock</span>
              {bajos > 0 && <span className="bodega-card__warn"><TriangleAlert size={16} /> <b>{bajos}</b> con poco stock</span>}
            </span>
          </button>
        ))}
      </div>

      {activa && (
        <section className="card table-card">
          <div className="card__head"><div><h2>Contenido de {activa.b.nombre}</h2><p className="sub">{activa.b.ubicacion}</p></div></div>
          <div className="toolbar">
            <span className="search">
              <Search size={20} strokeWidth={1.9} aria-hidden="true" />
              <input className="input" type="search" aria-label="Buscar en la bodega" placeholder="Buscar insumo en esta bodega" value={q} onChange={(e) => setQ(e.target.value)} />
            </span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Insumo</th><th>Categoría</th><th className="right">En esta bodega</th><th className="right">Total en el predio</th><th>Estado del insumo</th></tr></thead>
              <tbody>
                {filas.length === 0 && <tr><td colSpan={5} className="empty">{activa.items.length ? 'Ningún insumo coincide.' : 'Esta bodega no tiene insumos con stock.'}</td></tr>}
                {filas.map(({ p, hay }) => {
                  const e = ESTADO_STOCK[estadoStock(p)]
                  return (
                    <tr key={p.id}>
                      <td><div className="name">{p.nombre}</div><div className="sub">{p.codigo}</div></td>
                      <td>{p.categoria}</td>
                      <td className="right num">{num(hay)} {p.unidad_medida}</td>
                      <td className="right">{num(p.stock_actual)} {p.unidad_medida}<div className="sub">{Math.round((hay / Number(p.stock_actual)) * 100)} % está aquí</div></td>
                      <td><Badge tone={e.tone}>{e.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
