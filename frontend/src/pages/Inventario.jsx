import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, Plus, TriangleAlert, Ban } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { Badge, Button, Estado, PageHeader, StatCard } from '../components/ui'
import { AnularModal, InventarioModal } from '../components/modals-extra'
import { dmy, esAnulado, num, parseDate } from '../lib/format'

const RECURSOS = ['inventarios', 'detalle-inventarios', 'productos', 'bodegas', 'usuarios']

function desviacion(detalles) {
  const sis = detalles.reduce((s, d) => s + Number(d.stock_sistema), 0)
  const real = detalles.reduce((s, d) => s + Number(d.stock_real), 0)
  return sis ? ((real - sis) / sis) * 100 : 0
}
const pct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`

export default function Inventario() {
  const { usuario } = useAuth()
  const { data, loading, error, reload } = useRecursos(RECURSOS)
  const [abierto, setAbierto] = useState(null)
  const [modal, setModal] = useState(null)

  const filas = useMemo(() => {
    if (!data.inventarios) return []
    const bod = new Map(data.bodegas.map((b) => [b.id, b]))
    const usu = new Map(data.usuarios.map((u) => [u.id, u]))
    return [...data.inventarios]
      .sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha) || b.id - a.id)
      .map((i) => {
        const detalles = data['detalle-inventarios'].filter((d) => d.inventario === i.id)
        return { ...i, detalles, dev: desviacion(detalles), bodegaNombre: bod.get(i.bodega)?.nombre ?? '—', responsable: usu.get(i.usuario)?.nombre_completo ?? '—', quienAnula: usu.get(i.usuario_anula)?.nombre_completo }
      })
  }, [data])

  const cabecera = <PageHeader title="Inventario" subtitle="Revisa los conteos físicos de bodega y cuánto se desvían del stock del sistema."
    actions={<Button icon={Plus} onClick={() => setModal('nuevo')}>Registrar inventario</Button>} />
  if (loading && !data.inventarios) return <>{cabecera}<Estado cargando /></>
  if (error && !data.inventarios) return <>{cabecera}<Estado error={error} /></>

  const vigentes = filas.filter((f) => !esAnulado(f))
  const ultimo = vigentes[0]
  const anulados = filas.length - vigentes.length
  const prod = new Map(data.productos.map((p) => [p.id, p]))

  return (
    <>
      {cabecera}
      <div className="stats stats--3">
        <StatCard icon={ClipboardList} label="Inventarios realizados" value={vigentes.length} note={ultimo ? `Último: ${dmy(parseDate(ultimo.fecha))}` : 'Aún no hay conteos'} />
        <StatCard icon={TriangleAlert} tone="warning" label="Desviación del último" value={ultimo ? pct(ultimo.dev) : '—'} note="Real contra sistema" />
        <StatCard icon={Ban} tone="neutral" label="Anulados" value={anulados} note="Quedan registrados con su motivo" />
      </div>

      <section className="card table-card">
        <div className="table-wrap table-wrap--top">
          <table className="table table--inv">
            <thead><tr><th aria-label="Detalle" className="col-chev" /><th>Fecha</th><th>Bodega</th><th>Responsable</th><th className="right">Desviación</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {filas.length === 0 && <tr><td colSpan={7} className="empty">Todavía no hay inventarios registrados.</td></tr>}
              {filas.map((f) => {
                const anulado = esAnulado(f)
                const open = abierto === f.id
                return (
                  <Fragment key={f.id}>
                    <tr className={anulado ? 'row--muted' : ''}>
                      <td className="col-chev">
                        <button type="button" className="icon-btn" aria-expanded={open} aria-label={open ? 'Ocultar detalle' : 'Ver detalle'} onClick={() => setAbierto(open ? null : f.id)}>
                          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </td>
                      <td className="nowrap name name--plain">{dmy(parseDate(f.fecha))}</td>
                      <td>{f.bodegaNombre}</td>
                      <td>{f.responsable}</td>
                      <td className="right num">{f.detalles.length ? pct(f.dev) : '—'}</td>
                      <td><Badge tone={anulado ? 'danger' : 'success'}>{anulado ? 'Anulado' : 'Confirmado'}</Badge></td>
                      <td className="right">{!anulado && <button type="button" className="link-btn link-btn--danger" onClick={() => setModal({ anular: f })}>Anular</button>}</td>
                    </tr>
                    {open && (
                      <tr className="row--detail">
                        <td colSpan={7}>
                         <div className="detail-wrap">
                          {anulado && (
                            <p className="annul"><b>Anulado el {dmy(parseDate(f.fecha_anulacion))}</b>{f.quienAnula ? ` por ${f.quienAnula}` : ''}. Motivo: {f.motivo_anulacion}</p>
                          )}
                          {f.detalles.length === 0 ? <p className="muted">Este inventario no tiene insumos contados.</p> : (
                            <table className="table table--compact table--nested">
                              <thead><tr><th>Insumo</th><th className="right">En sistema</th><th className="right">Stock real</th><th className="right">Diferencia</th></tr></thead>
                              <tbody>
                                {f.detalles.map((d) => {
                                  const p = prod.get(d.producto)
                                  const dif = Number(d.stock_real) - Number(d.stock_sistema)
                                  return (
                                    <tr key={d.id}>
                                      <td><span className="name">{p?.nombre ?? 'Insumo'}</span> <span className="sub">{p?.codigo}</span></td>
                                      <td className="right">{num(d.stock_sistema)} {p?.unidad_medida}</td>
                                      <td className="right">{num(d.stock_real)} {p?.unidad_medida}</td>
                                      <td className={`right diff ${dif < 0 ? 'diff--neg' : ''}`}>{dif > 0 ? '+' : ''}{num(dif)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                         </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'nuevo' && <InventarioModal productos={data.productos} bodegas={data.bodegas} usuario={usuario} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.anular && <AnularModal inventario={modal.anular} usuario={usuario} onClose={() => setModal(null)} onSaved={reload} />}
    </>
  )
}
