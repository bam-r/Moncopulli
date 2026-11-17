import { useState } from 'react'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { actualizar, iniciarSesion } from '../api/services'
import { Badge, Button, Estado, Field, PageHeader } from '../components/ui'
import { BodegaModal } from '../components/modals-extra'
import { useToast } from '../components/Toast'
import { esAdmin } from '../lib/format'

function Perfil() {
  const { usuario, actualizarUsuario } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ email: usuario.email ?? '', telefono: usuario.telefono ?? '' })
  const [err, setErr] = useState({})
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const cambios = f.email !== (usuario.email ?? '') || f.telefono !== (usuario.telefono ?? '')

  const guardar = async (e) => {
    e.preventDefault()
    const n = {}
    if (!/^\S+@\S+\.\S+$/.test(f.email)) n.email = 'Correo inválido.'
    if (!f.telefono.trim()) n.telefono = 'Ingresa un teléfono.'
    setErr(n); setMsg('')
    if (Object.keys(n).length) return
    setEnviando(true)
    try {
      const datos = { email: f.email.trim(), telefono: f.telefono.trim() }
      await actualizar('usuarios', usuario.id, datos)
      actualizarUsuario(datos)
      toast('Datos actualizados')
    } catch (e2) { setMsg(e2.message || 'No se pudo guardar') } finally { setEnviando(false) }
  }

  return (
    <section className="card settings-card">
      <header><h2>Mi perfil</h2><p className="sub">Tus datos de acceso. El nombre, RUT y puesto los gestiona un administrador desde Usuarios.</p></header>
      <dl className="kv">
        <div className="kv__item"><dt>Nombre</dt><dd>{usuario.nombre_completo}</dd></div>
        <div className="kv__item"><dt>RUT</dt><dd>{usuario.rut}</dd></div>
        <div className="kv__item"><dt>Puesto</dt><dd>{usuario.puesto}</dd></div>
        <div className="kv__item"><dt>Rol</dt><dd>{esAdmin(usuario) ? 'Administrador' : 'Trabajador'}</dd></div>
      </dl>
      <form className="form form--inline" onSubmit={guardar} noValidate>
        <div className="form__row">
          <Field label="Correo" error={err.email}>{(id) => <input id={id} className="input" type="email" maxLength={80} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Teléfono" error={err.telefono}>{(id) => <input id={id} className="input" type="tel" maxLength={15} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />}</Field>
        </div>
        <div className="form__actions">
          {msg && <span className="hint hint--error" role="alert">{msg}</span>}
          <button type="submit" className="btn btn--primary" disabled={!cambios || enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </section>
  )
}

function Clave() {
  const { usuario } = useAuth()
  const toast = useToast()
  const vacio = { actual: '', nueva: '', repetir: '' }
  const [f, setF] = useState(vacio)
  const [ver, setVer] = useState(false)
  const [err, setErr] = useState({})
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    const n = {}
    if (!f.actual) n.actual = 'Ingresa tu contraseña actual.'
    if (f.nueva.length < 6) n.nueva = 'Mínimo 6 caracteres.'
    else if (f.nueva === f.actual) n.nueva = 'Debe ser distinta de la actual.'
    if (f.repetir !== f.nueva) n.repetir = 'Las contraseñas no coinciden.'
    setErr(n); setMsg('')
    if (Object.keys(n).length) return
    setEnviando(true)
    try {
      await iniciarSesion(usuario.rut, f.actual)
    } catch { setErr({ actual: 'La contraseña actual no es correcta.' }); setEnviando(false); return }
    try {
      await actualizar('usuarios', usuario.id, { contrasena: f.nueva })
      setF(vacio); toast('Contraseña actualizada')
    } catch (e2) { setMsg(e2.message || 'No se pudo guardar') } finally { setEnviando(false) }
  }
  const campo = (k, label) => (
    <Field label={label} error={err[k]}>
      {(id) => <input id={id} className="input" type={ver ? 'text' : 'password'} autoComplete={k === 'actual' ? 'current-password' : 'new-password'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </Field>
  )
  return (
    <section className="card settings-card">
      <header><h2>Cambiar contraseña</h2><p className="sub">Usa al menos 6 caracteres.</p></header>
      <form className="form form--inline" onSubmit={guardar} noValidate>
        {campo('actual', 'Contraseña actual')}
        <div className="form__row">{campo('nueva', 'Contraseña nueva')}{campo('repetir', 'Repite la contraseña nueva')}</div>
        <div className="form__actions">
          <button type="button" className="link-btn" onClick={() => setVer(!ver)}>{ver ? <EyeOff size={16} /> : <Eye size={16} />} {ver ? 'Ocultar' : 'Mostrar'} contraseñas</button>
          {msg && <span className="hint hint--error" role="alert">{msg}</span>}
          <button type="submit" className="btn btn--primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </div>
      </form>
    </section>
  )
}

function Bodegas() {
  const { data, loading, error, reload } = useRecursos(['bodegas'])
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [fallo, setFallo] = useState('')
  const cambiar = async (b) => {
    setFallo('')
    try { await actualizar('bodegas', b.id, { estado: !(b.estado !== false) }); toast(b.estado !== false ? 'Bodega desactivada' : 'Bodega activada'); reload() }
    catch (e) { setFallo(e.message || 'No se pudo guardar') }
  }
  return (
    <section className="card settings-card settings-card--table">
      <header className="settings-card__head">
        <div><h2>Bodegas</h2><p className="sub">Solo las bodegas activas aparecen al registrar salidas, compras e inventarios.</p></div>
        <Button variant="secondary" icon={Plus} onClick={() => setModal(true)}>Añadir bodega</Button>
      </header>
      {loading && !data.bodegas ? <Estado cargando /> : error && !data.bodegas ? <Estado error={error} /> : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>Nombre</th><th>Ubicación</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {data.bodegas.length === 0 && <tr><td colSpan={4} className="empty">Todavía no hay bodegas.</td></tr>}
              {data.bodegas.map((b) => {
                const activa = b.estado !== false
                return (
                  <tr key={b.id}>
                    <td className="name name--plain">{b.nombre}</td><td>{b.ubicacion}</td>
                    <td><Badge tone={activa ? 'success' : 'danger'}>{activa ? 'Activa' : 'Inactiva'}</Badge></td>
                    <td className="right"><button type="button" className="link-btn" onClick={() => cambiar(b)}>{activa ? 'Desactivar' : 'Activar'}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {fallo && <p className="hint hint--error settings-card__msg" role="alert">{fallo}</p>}
      {modal && <BodegaModal onClose={() => setModal(false)} onSaved={reload} />}
    </section>
  )
}

export default function Configuracion() {
  const { usuario } = useAuth()
  const admin = esAdmin(usuario)
  return (
    <>
      <PageHeader title="Configuración" subtitle={admin ? 'Tu cuenta y las bodegas del predio.' : 'Tu cuenta.'} />
      <div className="settings">
        <Perfil />
        <Clave />
        {admin && <Bodegas />}
      </div>
    </>
  )
}
