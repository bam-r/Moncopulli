import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { Avatar, Badge, Button, Estado, PageHeader, Select } from '../components/ui'
import { UsuarioModal } from '../components/modals'
import { ultimoConsumoPorUsuario } from '../lib/movimientos'
import { esActivo, iniciales, num, ultimoRetiro } from '../lib/format'

const POR_PAGINA = 5

export default function Usuarios() {
  const { usuario: usuarioActual, actualizarUsuario } = useAuth()
  const { data, loading, error, reload } = useRecursos(['usuarios', 'consumos', 'productos'])
  const [q, setQ] = useState('')
  const [est, setEst] = useState('')
  const [pagina, setPagina] = useState(1)
  const [modal, setModal] = useState(null)

  const ultimos = useMemo(() => ultimoConsumoPorUsuario(data.consumos ?? [], data.productos ?? []), [data.consumos, data.productos])
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data.usuarios ?? []).filter((u) =>
      (!t || u.nombre_completo.toLowerCase().includes(t) || u.puesto.toLowerCase().includes(t)) &&
      (!est || (est === 'activo') === esActivo(u)))
  }, [data.usuarios, q, est])

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const actual = Math.min(pagina, paginas)
  const desde = (actual - 1) * POR_PAGINA
  const visibles = filtrados.slice(desde, desde + POR_PAGINA)

  const cabecera = (
    <PageHeader title="Usuarios" subtitle="Gestiona al personal y revisa sus últimos movimientos de stock."
      actions={<Button icon={Plus} onClick={() => setModal('nuevo')}>Añadir usuario</Button>} />
  )
  if (loading && !data.usuarios) return <>{cabecera}<Estado cargando /></>
  if (error && !data.usuarios) return <>{cabecera}<Estado error={error} /></>

  return (
    <>
      {cabecera}
      <section className="card table-card">
        <div className="toolbar toolbar--users">
          <span className="search">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            <input className="input" type="search" aria-label="Buscar usuario" placeholder="Buscar por nombre o puesto" value={q} onChange={(e) => { setQ(e.target.value); setPagina(1) }} />
          </span>
          <Select aria-label="Estado" value={est} onChange={(e) => { setEst(e.target.value); setPagina(1) }}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </Select>
        </div>

        <div className="table-wrap">
          <table className="table table--users">
            <thead><tr><th>Nombre</th><th>Puesto</th><th>Último Retiro</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={5} className="empty">No hay usuarios que coincidan.</td></tr>}
              {visibles.map((u) => {
                const r = ultimos.get(u.id)
                const activo = esActivo(u)
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="person">
                        <Avatar>{iniciales(u.nombre_completo)}</Avatar>
                        <div><div className="name">{u.nombre_completo}</div><div className="sub">{u.email}</div></div>
                      </div>
                    </td>
                    <td>{u.puesto}</td>
                    <td>
                      {r ? (
                        <><div className="name name--plain">{Number.isInteger(r.cantidad) ? r.cantidad : num(r.cantidad)} {r.unidad} de {r.producto}</div><div className="sub">{ultimoRetiro(r.fecha)}</div></>
                      ) : (
                        <><div className="name name--plain name--empty">Sin retiros registrados</div><div className="sub">-</div></>
                      )}
                    </td>
                    <td><Badge tone={activo ? 'success' : 'danger'}>{activo ? 'Activo' : 'Inactivo'}</Badge></td>
                    <td className="right"><button type="button" className="icon-btn" aria-label={`Editar ${u.nombre_completo}`} onClick={() => setModal(u)}><Pencil size={16} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="foot">
          <span>{filtrados.length ? `Mostrando ${desde + 1}-${desde + visibles.length} de ${filtrados.length} usuarios` : 'Sin resultados'}</span>
          <div className="pager">
            <button type="button" className="pager__btn" aria-label="Página anterior" disabled={actual === 1} onClick={() => setPagina(actual - 1)}><ChevronLeft size={16} /></button>
            {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`pager__btn ${n === actual ? 'pager__btn--on' : ''}`} aria-current={n === actual ? 'page' : undefined} onClick={() => setPagina(n)}>{n}</button>
            ))}
            <button type="button" className="pager__btn" aria-label="Página siguiente" disabled={actual === paginas} onClick={() => setPagina(actual + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>
      {modal && <UsuarioModal usuario={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)}
        onSaved={(actualizado) => {
          reload()
          if (actualizado?.id === usuarioActual.id) actualizarUsuario(actualizado)
        }} />}
    </>
  )
}
