import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ClipboardList, PackagePlus, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { Button, Estado, PageHeader, StatCard } from '../components/ui'
import { CompraModal, SalidaModal } from '../components/modals'
import { construirMovimientos, ultimoInventario } from '../lib/movimientos'
import { cuando, diasDesdeHoy, esAnulado, num, parseDate } from '../lib/format'

const RECURSOS = ['productos', 'consumos', 'documentos-compra', 'detalle-documentos', 'usuarios', 'proveedores', 'bodegas', 'inventarios', 'detalle-inventarios']

export default function Resumen() {
  const { usuario } = useAuth()
  const { data, loading, error, reload } = useRecursos(RECURSOS)
  const [modal, setModal] = useState(null)
  const acciones = (
    <>
      <Button variant="secondary" icon={ArrowUpRight} onClick={() => setModal('salida')}>Registrar salida</Button>
      <Button icon={Plus} onClick={() => setModal('compra')}>Agregar Compra</Button>
    </>
  )
  const cabecera = <PageHeader title="Resumen" subtitle="Revisa todo lo que ha pasado recientemente." actions={acciones} />
  if (loading && !data.productos) return <>{cabecera}<Estado cargando /></>
  if (error && !data.productos) return <>{cabecera}<Estado error={error} /></>

  const movs = construirMovimientos({
    consumos: data.consumos, documentos: data['documentos-compra'], detalles: data['detalle-documentos'],
    productos: data.productos, usuarios: data.usuarios, proveedores: data.proveedores,
  })
  const insumosRecientes = data['detalle-documentos'].filter((d) => {
    const doc = data['documentos-compra'].find((x) => x.id === d.documento)
    return doc && diasDesdeHoy(parseDate(doc.fecha_emision)) <= 2
  }).length
  const consumosHoy = data.consumos.filter((c) => !esAnulado(c) && diasDesdeHoy(parseDate(c.fecha)) === 0).length
  const inv = ultimoInventario(data.inventarios, data['detalle-inventarios'])

  return (
    <>
      {cabecera}
      <div className="stats stats--3">
        <StatCard icon={PackagePlus} title={`${insumosRecientes} ${insumosRecientes === 1 ? 'insumo agregado' : 'insumos agregados'} recientemente`} note="Últimas 48 horas" />
        <StatCard icon={ArrowUpRight} tone="warning" title={`${consumosHoy} ${consumosHoy === 1 ? 'consumo registrado' : 'consumos registrados'} hoy`} note="Salidas confirmadas" />
        <StatCard icon={ClipboardList} tone="neutral" title="Último inventario realizado"
          note={inv ? `Desviación: ${inv.desviacion.toFixed(0)}%` : 'Aún no hay inventarios'} />
      </div>

      <section className="card table-card">
        <div className="table-wrap">
          <table className="table table--feed">
            <thead><tr><th>Fecha</th><th>Movimiento</th><th>Detalle</th><th className="right">Cantidad</th></tr></thead>
            <tbody>
              {movs.length === 0 && <tr><td colSpan={4} className="empty">Todavía no hay movimientos.</td></tr>}
              {movs.map((m) => (
                <tr key={m.key} className={m.tipo === 'entrada' ? 'row--hl' : ''}>
                  <td className="nowrap">{cuando(m.fecha, m.conHora)}</td>
                  <td>
                    <span className={`chip ${m.tipo === 'entrada' ? 'chip--on-primary' : ''}`}>
                      {m.tipo === 'entrada' ? <ArrowDownLeft size={14} strokeWidth={1.75} /> : <ArrowUpRight size={14} strokeWidth={1.75} />}
                      {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="detail">
                    {m.tipo === 'entrada'
                      ? <>Compra proveedor <b>{m.proveedor}</b>, producto <b>{m.producto}</b>{m.codigo ? `, código ${m.codigo}` : ''}.</>
                      : <><b>{m.usuario}</b> ha retirado {m.producto}.</>}
                  </td>
                  <td className="right nowrap strong">{m.tipo === 'entrada' ? '+' : ''}{Number.isInteger(m.cantidad) ? m.cantidad : num(m.cantidad)} {m.unidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'salida' && <SalidaModal productos={data.productos} bodegas={data.bodegas} usuario={usuario} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'compra' && <CompraModal productos={data.productos} proveedores={data.proveedores} bodegas={data.bodegas} usuario={usuario} onClose={() => setModal(null)} onSaved={reload} />}
    </>
  )
}
