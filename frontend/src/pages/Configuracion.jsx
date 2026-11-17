import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import {
  actualizar, actualizarPerfil, actualizarPreferencias, cambiarContrasena,
  eliminarCuenta, exportarDatos, leerPreferencias,
} from '../api/services'
import { setToken } from '../api/client'
import { limpiarNotificaciones } from '../api/notifications'
import { eliminarPendientesUsuario, leerPendientes } from '../api/pending'
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
      await actualizarPerfil(datos)
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
    if (f.nueva.length < 10) n.nueva = 'Mínimo 10 caracteres.'
    else if (f.nueva === f.actual) n.nueva = 'Debe ser distinta de la actual.'
    if (f.repetir !== f.nueva) n.repetir = 'Las contraseñas no coinciden.'
    setErr(n); setMsg('')
    if (Object.keys(n).length) return
    setEnviando(true)
    try {
      await cambiarContrasena({ contrasena_actual: f.actual, contrasena_nueva: f.nueva })
      setF(vacio); toast('Contraseña actualizada')
    } catch (e2) { setMsg(e2.message || 'No se pudo guardar') } finally { setEnviando(false) }
  }
  const campo = (k, label) => (
    <Field label={label} error={err[k]}>
      {(id) => <input id={id} className="input" type={ver ? 'text' : 'password'} maxLength={1024} autoComplete={k === 'actual' ? 'current-password' : 'new-password'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </Field>
  )
  return (
    <section className="card settings-card">
      <header><h2>Cambiar contraseña</h2><p className="sub">Usa al menos 10 caracteres.</p></header>
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

function Privacidad() {
  const { usuario, logout } = useAuth()
  const toast = useToast()
  const [preferencias, setPreferencias] = useState({ marketing: false, perfilamiento: false })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [clave, setClave] = useState('')

  useEffect(() => {
    let cancelado = false
    leerPreferencias()
      .then((valores) => { if (!cancelado) setPreferencias(valores) })
      .catch((e) => { if (!cancelado) setError(e.message || 'No se pudieron cargar las preferencias.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  const cambiar = async (campo, valor) => {
    setError('')
    try {
      const actualizadas = await actualizarPreferencias({ [campo]: valor })
      setPreferencias(actualizadas)
    } catch (e) { setError(e.message || 'No se pudo guardar la preferencia.') }
  }

  const descargar = async () => {
    setError('')
    try {
      const datos = await exportarDatos()
      const pendientes = leerPendientes()
        .filter((item) => String(item.usuario) === String(usuario.id))
        .map(({ _local, ...item }) => item)
      const url = URL.createObjectURL(new Blob([
        JSON.stringify({ ...datos, operaciones_pendientes_offline: pendientes }, null, 2),
      ], { type: 'application/json' }))
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = 'moncopulli-mis-datos.json'
      enlace.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e.message || 'No se pudieron exportar tus datos.') }
  }

  const borrarCuenta = async () => {
    if (!clave) { setError('Ingresa tu contraseña para confirmar.'); return }
    if (!window.confirm('Se eliminarán tus datos directos de perfil y se cerrará la sesión. Por trazabilidad, el identificador interno de movimientos conservados puede seguir vinculado a un perfil seudónimo; esto no equivale a anonimización irreversible. ¿Continuar?')) return
    setError('')
    try {
      await eliminarCuenta(clave)
      eliminarPendientesUsuario(usuario.id)
      limpiarNotificaciones(usuario.id)
      setToken(null)
      await logout()
      toast('La cuenta fue anonimizada')
    } catch (e) { setError(e.message || 'No se pudo anonimizar la cuenta.') }
  }

  return (
    <section className="card settings-card">
      <header><h2>Privacidad y datos personales</h2><p className="sub">Descarga una copia de tus datos o administra finalidades opcionales.</p></header>
      <div className="form__actions">
        <Link className="btn btn--secondary" to="/mi-informacion">Ver mi información / Exportar PDF</Link>
        <button type="button" className="btn btn--secondary" onClick={descargar}>Descargar mis datos (JSON)</button>
      </div>
      <div className="form">
        <label className="privacy-consent">
          <input type="checkbox" checked={preferencias.marketing} disabled={cargando} onChange={(e) => cambiar('marketing', e.target.checked)} />
          <span>Acepto recibir comunicaciones de marketing.</span>
        </label>
        <label className="privacy-consent">
          <input type="checkbox" checked={preferencias.perfilamiento} disabled={cargando} onChange={(e) => cambiar('perfilamiento', e.target.checked)} />
          <span>Acepto el uso de mis datos para perfilamiento opcional.</span>
        </label>
      </div>
      <p className="sub">Estas opciones son voluntarias y pueden revocarse aquí. La aplicación no carga actualmente scripts de analítica ni publicidad.</p>
      <div className="form">
        <h3>Eliminar datos de mi perfil</h3>
        <p className="sub">Se eliminarán tus identificadores directos. El historial operacional puede conservar un identificador seudónimo para mantener su trazabilidad; esto no equivale a anonimización irreversible.</p>
        <div className="form__row">
          <Field label={`Confirma con tu contraseña (${usuario.rut})`}>
            {(id) => <input id={id} className="input" type="password" maxLength={1024} autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />}
          </Field>
          <button type="button" className="btn btn--secondary" onClick={borrarCuenta}>Eliminar datos de perfil</button>
        </div>
      </div>
      {error && <p className="hint hint--error" role="alert">{error}</p>}
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
        <Privacidad />
        {admin && <Bodegas />}
      </div>
    </>
  )
}
