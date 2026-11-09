import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CircleHelp, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Brand } from '../components/AppLayout'
import { Button, Field, Modal } from '../components/ui'
import { formatRut, isValidRut } from '../lib/rut'
import { esAdmin } from '../lib/format'

export default function Login() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()
  const [rut, setRut] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [olvido, setOlvido] = useState(false)
  const [correoRecuperacion, setCorreoRecuperacion] = useState('')

  if (usuario) return <Navigate to={esAdmin(usuario) ? '/resumen' : '/stock'} replace />

  const submit = async (e) => {
    e.preventDefault()
    const n = {}
    if (!isValidRut(rut)) n.rut = 'RUT inválido. Revisa el dígito verificador.'
    if (!clave) n.clave = 'Ingresa tu contraseña.'
    setErrores(n); setErrorGeneral('')
    if (Object.keys(n).length) return
    setEnviando(true)
    try {
      const u = await login(rut, clave)
      navigate(esAdmin(u) ? '/resumen' : '/stock', { replace: true })
    } catch (err) {
      setErrorGeneral(err.message || 'No se pudo iniciar sesión.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="login-page">
      <header className="login-top">
        <Brand />
        <button type="button" className="help-link" onClick={() => setOlvido(true)}><CircleHelp size={20} strokeWidth={1.75} /> Ayuda</button>
      </header>

      <main className="login-main">
        <form className="card login" onSubmit={submit} noValidate>
          <div>
            <h1>Iniciar sesión</h1>
            <p>Ingresa tus datos para acceder a la gestión agrícola de Moncopulli.</p>
          </div>

          <Field label="RUT" hint="Incluye el digito verificador." error={errores.rut}>
            {(id) => (
              <input id={id} className="input" inputMode="text" autoComplete="username" placeholder="Ej. 12.345.678-9"
                value={rut} onChange={(e) => setRut(formatRut(e.target.value))} aria-invalid={!!errores.rut} />
            )}
          </Field>

          <div className="field">
            <Field label="Contraseña" error={errores.clave}>
              {(id) => (
                <span className="control">
                  <input id={id} className="input input--pad-end" type={ver ? 'text' : 'password'} autoComplete="current-password"
                    placeholder="Ingresa tu contraseña" value={clave} onChange={(e) => setClave(e.target.value)} aria-invalid={!!errores.clave} />
                  <button type="button" className="control__btn" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {ver ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
                  </button>
                </span>
              )}
            </Field>
            <button type="button" className="link-btn link-btn--end" onClick={() => setOlvido(true)}>¿Olvidaste tu contraseña?</button>
          </div>

          {errorGeneral && <p className="notice notice--error" role="alert">{errorGeneral}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={enviando}>{enviando ? 'Ingresando…' : 'Iniciar sesión'}</button>
        </form>
        <p className="login-note">Si necesitas acceso, contacta al administrador.</p>
      </main>

      <footer className="login-foot"><b>Agricola Moncopulli</b><span>Los Lagos, Chile</span></footer>
      {olvido && (
        <Modal title="Recuperar contraseña" onClose={() => setOlvido(false)} footer={<Button onClick={() => setOlvido(false)}>Entendido</Button>}>
          <div className="form">
            <p>Ingrese el correo asociado a la cuenta para recuperar el acceso.</p>
            <Field label="Correo electrónico">
              {(id) => <input id={id} className="input" type="email" autoComplete="email" placeholder="nombre@ejemplo.cl" value={correoRecuperacion} onChange={(e) => setCorreoRecuperacion(e.target.value)} />}
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
