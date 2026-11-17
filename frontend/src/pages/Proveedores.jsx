import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search } from 'lucide-react'
import { useRecursos } from '../api/hooks'
import { actualizar } from '../api/services'
import { Avatar, Badge, Button, Estado, Modal, PageHeader, Select } from '../components/ui'
import { ProveedorModal } from '../components/modals-extra'
import { useToast } from '../components/Toast'
import { dmy, iniciales, parseDate, pesos } from '../lib/format'

const POR_PAGINA = 5

function Dato({ etiqueta, children }) {
  return <div className="kv__item"><dt>{etiqueta}</dt><dd>{children || '—'}</dd></div>
}

function DetalleProveedor({ proveedor, compras, onClose, onSaved, onEdit }) {
  const toast = useToast()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const activo = proveedor.estado !== false
  const cambiar = async () => {
    setEnviando(true); setError('')
    try { await actualizar('proveedores', proveedor.id, { estado: !activo }); toast(activo ? 'Proveedor desactivado' : 'Proveedor activado'); onSaved(); onClose() }
    catch (e) { setError(e.message || 'No se pudo guardar') } finally { setEnviando(false) }
  }
  return (
    <Modal title={proveedor.nombre} wide onClose={onClose}
      footer={<>{error && <span className="hint hint--error modal__error" role="alert">{error}</span>}
        <Button variant="secondary" icon={Pencil} onClick={() => onEdit(proveedor)}>Editar</Button>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        <button type="button" className={`btn ${activo ? 'btn--danger-outline' : 'btn--primary'}`} disabled={enviando} onClick={cambiar}>{activo ? 'Desactivar proveedor' : 'Activar proveedor'}</button></>}>
      <dl className="kv">
        <Dato etiqueta="Razón social">{proveedor.razon_social}</Dato>
        <Dato etiqueta="RUT">{proveedor.rut}</Dato>
        <Dato etiqueta="Categoría">{proveedor.categoria}</Dato>
        <Dato etiqueta="Estado"><Badge tone={activo ? 'success' : 'danger'}>{activo ? 'Activo' : 'Inactivo'}</Badge></Dato>
        <Dato etiqueta="Contacto">{proveedor.contacto}</Dato>
        <Dato etiqueta="Teléfono">{proveedor.telefono}</Dato>
        <Dato etiqueta="Correo">{proveedor.correo}</Dato>
        <Dato etiqueta="Domicilio legal">{proveedor.domicilio_legal}</Dato>
        <Dato etiqueta="Plazo de pago">{`${proveedor.plazo_pago} días`}</Dato>
        <Dato etiqueta="Límite de crédito">{pesos(proveedor.limite_credito)}</Dato>
      </dl>
      <h3 className="subhead">Últimas compras</h3>
      {compras.length === 0 ? <p className="muted">Todavía no hay compras a este proveedor.</p> : (
        <table className="table table--compact">
          <thead><tr><th>Fecha</th><th>Documento</th><th className="right">Total</th></tr></thead>
          <tbody>{compras.slice(0, 5).map((c) => <tr key={c.id}><td>{dmy(c.fecha)}</td><td>{c.tipo_documento} N° {c.numero_folio}</td><td className="right">{pesos(c.total)}</td></tr>)}</tbody>
        </table>
      )}
    </Modal>
  )
}

export default function Proveedores() {
  const { data, loading, error, reload } = useRecursos(['proveedores', 'documentos-compra', 'detalle-documentos'])
  const [q, setQ] = useState('')
  const [est, setEst] = useState('')
  const [pagina, setPagina] = useState(1)
  const [modal, setModal] = useState(null)
  const comprasDe = useMemo(() => {
    const m = new Map()
    ;(data['documentos-compra'] ?? []).forEach((d) => {
      const total = data['detalle-documentos'].filter((l) => l.documento === d.id).reduce((s, l) => s + Number(l.cantidad) * Number(l.precio_unitario), 0)
      m.set(d.proveedor, [...(m.get(d.proveedor) ?? []), { ...d, fecha: parseDate(d.fecha_emision), total }])
    })
    m.forEach((v) => v.sort((a, b) => b.fecha - a.fecha))
    return m
  }, [data])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data.proveedores ?? []).filter((p) =>
      (!t || p.nombre.toLowerCase().includes(t) || p.razon_social.toLowerCase().includes(t) || p.rut.toLowerCase().includes(t)) &&
      (!est || (est === 'activo') === (p.estado !== false)))
  }, [data.proveedores, q, est])

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const actual = Math.min(pagina, paginas)
  const desde = (actual - 1) * POR_PAGINA
  const visibles = filtrados.slice(desde, desde + POR_PAGINA)

  const cabecera = <PageHeader title="Proveedores" subtitle="Consulta a quién le compras y revisa sus últimas compras."
    actions={<Button icon={Plus} onClick={() => setModal('nuevo')}>Añadir proveedor</Button>} />
  if (loading && !data.proveedores) return <>{cabecera}<Estado cargando /></>
  if (error && !data.proveedores) return <>{cabecera}<Estado error={error} /></>

  return (
    <>
      {cabecera}
      <section className="card table-card">
        <div className="toolbar toolbar--users">
          <span className="search">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            <input className="input" type="search" aria-label="Buscar proveedor" placeholder="Buscar por nombre o RUT" value={q} onChange={(e) => { setQ(e.target.value); setPagina(1) }} />
          </span>
          <Select aria-label="Estado" value={est} onChange={(e) => { setEst(e.target.value); setPagina(1) }}>
            <option value="">Todos los estados</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option>
          </Select>
        </div>
        <div className="table-wrap">
          <table className="table table--prov">
            <thead><tr><th>Proveedor</th><th>Categoría</th><th>Contacto</th><th>Última compra</th><th>Plazo de pago</th><th>Estado</th></tr></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={6} className="empty">No hay proveedores que coincidan.</td></tr>}
              {visibles.map((p) => {
                const ultima = comprasDe.get(p.id)?.[0]?.fecha ?? (p.ultima_compra ? parseDate(p.ultima_compra) : null)
                const activo = p.estado !== false
                return (
                  <tr key={p.id}>
                    <td>
                      <button type="button" className="person person--btn" onClick={() => setModal(p)} aria-label={`Ver detalle de ${p.nombre}`}>
                        <Avatar>{iniciales(p.nombre)}</Avatar>
                        <span><span className="name">{p.nombre}</span><span className="sub">{p.rut}</span></span>
                      </button>
                    </td>
                    <td>{p.categoria}</td>
                    <td><div className="name name--plain">{p.contacto}</div><div className="sub">{p.telefono}</div></td>
                    <td className="nowrap">{ultima ? dmy(ultima) : '—'}</td>
                    <td className="nowrap">{p.plazo_pago} días</td>
                    <td><Badge tone={activo ? 'success' : 'danger'}>{activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="foot">
          <span>{filtrados.length ? `Mostrando ${desde + 1}-${desde + visibles.length} de ${filtrados.length} proveedores` : 'Sin resultados'}</span>
          <div className="pager">
            <button type="button" className="pager__btn" aria-label="Página anterior" disabled={actual === 1} onClick={() => setPagina(actual - 1)}><ChevronLeft size={16} /></button>
            {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`pager__btn ${n === actual ? 'pager__btn--on' : ''}`} aria-current={n === actual ? 'page' : undefined} onClick={() => setPagina(n)}>{n}</button>
            ))}
            <button type="button" className="pager__btn" aria-label="Página siguiente" disabled={actual === paginas} onClick={() => setPagina(actual + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      {modal === 'nuevo' && <ProveedorModal onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.editar && <ProveedorModal proveedor={modal.editar} onClose={() => setModal(null)} onSaved={reload} />}
      {modal && modal !== 'nuevo' && !modal.editar && <DetalleProveedor proveedor={modal} compras={comprasDe.get(modal.id) ?? []} onClose={() => setModal(null)} onSaved={reload} onEdit={(proveedor) => setModal({ editar: proveedor })} />}
    </>
  )
}
