import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Ellipsis, LogOut, MapPin, Sprout, WifiOff, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { dmy, esAdmin, iniciales } from '../lib/format'
import { sincronizarPendientes } from '../api/services'
import { useNotificaciones } from '../api/notifications'
import { useOnline, usePendientes } from '../api/hooks'
import { useToast } from './Toast'
import { Avatar } from './ui'
import { BARRA_ADMIN, BARRA_TRABAJADOR, menuPara, piePara, titulos } from './nav'

export function Brand({ size = 34 }) {
  return (
    <div className="brand">
      <span className="brand__mark" style={{ width: size, height: size }}><Sprout size={size * 0.6} strokeWidth={1.75} /></span>
      <span className="brand__word">Moncopulli</span>
    </div>
  )
}

function Sidebar({ admin }) {
  const item = (n) => (
    <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav__item ${isActive ? 'nav__item--active' : ''} ${n.destacado ? 'nav__item--destacado' : ''}`}>
      <n.icon size={22} strokeWidth={1.9} />
      {n.label}
    </NavLink>
  )
  return (
    <aside className="sidebar" aria-label="Menú principal">
      <div className="sidebar__brand"><Brand /></div>
      <div className="sidebar__scroll">
        {menuPara(admin).map((s) => (
          <div key={s.titulo} className="nav__group">
            <div className="overline">{s.titulo}</div>
            <nav className="nav" aria-label={s.titulo}>{s.items.map(item)}</nav>
          </div>
        ))}
      </div>
      <div className="sidebar__foot">
        <nav className="nav" aria-label="Ayuda y ajustes">{piePara(admin).map(item)}</nav>
        <div className="place">
          <Avatar tone="primary"><MapPin size={14} strokeWidth={1.75} /></Avatar>
          <div><b>Agricola Moncopulli</b><span>Los Lagos, Chile</span></div>
        </div>
      </div>
    </aside>
  )
}

// Barra de abajo en el celular: lo principal a un toque; el resto en "Más".
function BarraInferior({ admin, onLogout }) {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const [mas, setMas] = useState(false)
  useEffect(() => setMas(false), [pathname])
  const principales = admin ? BARRA_ADMIN : BARRA_TRABAJADOR
  const todos = [...menuPara(admin).flatMap((s) => s.items), ...piePara(admin)]
  const enBarra = principales.map((to) => todos.find((n) => n.to === to)).filter(Boolean)
  const enMas = menuPara(admin).map((s) => ({ ...s, items: s.items.filter((n) => !principales.includes(n.to)) })).filter((s) => s.items.length)
  const masActivo = !principales.includes(pathname)
  return (
    <>
      {mas && <div className="scrim" onClick={() => setMas(false)} />}
      {mas && (
        <section className="sheet" role="dialog" aria-modal="true" aria-label="Más opciones">
          <header className="sheet__head">
            <div><b>{usuario.nombre_completo}</b><span>{admin ? 'Administrador' : 'Trabajador'}</span></div>
            <button type="button" className="icon-btn" onClick={() => setMas(false)} aria-label="Cerrar"><X size={22} /></button>
          </header>
          {[...enMas, { titulo: 'Cuenta', items: piePara(admin) }].map((s) => (
            <div key={s.titulo} className="sheet__group">
              <div className="overline">{s.titulo}</div>
              <div className="sheet__grid">
                {s.items.map((n) => (
                  <NavLink key={n.to} to={n.to} className={({ isActive }) => `sheet__item ${isActive ? 'sheet__item--active' : ''}`}>
                    <n.icon size={24} strokeWidth={1.9} /><span>{n.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn--secondary btn--block btn--lg" onClick={onLogout}>
            <LogOut size={20} /> Cerrar sesión
          </button>
        </section>
      )}
      <nav className="bottom-nav" aria-label="Menú principal">
        {enBarra.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''} ${n.destacado ? 'bottom-nav__item--destacado' : ''}`}>
            <n.icon size={26} strokeWidth={1.9} /><span>{n.corto}</span>
          </NavLink>
        ))}
        <button type="button" className={`bottom-nav__item ${masActivo || mas ? 'bottom-nav__item--active' : ''}`} onClick={() => setMas((v) => !v)} aria-expanded={mas}>
          <Ellipsis size={26} strokeWidth={1.9} /><span>Más</span>
        </button>
      </nav>
    </>
  )
}

function UserMenu({ usuario, admin, onLogout }) {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    if (!abierto) return
    const f = (e) => { if (!e.target.closest?.('.user')) setAbierto(false) }
    document.addEventListener('mousedown', f)
    return () => document.removeEventListener('mousedown', f)
  }, [abierto])
  return (
    <div className="user">
      <button type="button" className="user__btn" onClick={() => setAbierto((v) => !v)} aria-haspopup="menu" aria-expanded={abierto}>
        <Avatar tone="primary">{iniciales(usuario.nombre_completo).slice(0, 1)}</Avatar>
        <span className="user__name">{admin ? 'Admin' : 'Trabajador'}</span>
        <ChevronDown size={16} strokeWidth={1.75} />
      </button>
      {abierto && (
        <div className="menu" role="menu">
          <div className="menu__who"><b>{usuario.nombre_completo}</b><span>{usuario.rut}</span></div>
          <button type="button" role="menuitem" onClick={onLogout}>
            <LogOut size={16} strokeWidth={1.75} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { usuario, logout } = useAuth()
  const admin = esAdmin(usuario)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const online = useOnline()
  const pendientes = usePendientes()
  const toast = useToast()
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false)
  const notificaciones = useNotificaciones(admin ? usuario : null)
  const seccion = titulos(admin)[pathname] ?? ''
  const salir = async () => {
    try { await logout() }
    catch { toast('La sesión local se cerró, pero no se pudo revocar en el servidor.') }
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!online || !pendientes.length) return
    sincronizarPendientes(usuario.id).then((n) => n && toast(`${n} ${n === 1 ? 'retiro sincronizado' : 'retiros sincronizados'}`))
  }, [online, pendientes.length === 0, usuario.id])

  return (
    <div className={`app ${admin ? '' : 'app--worker'}`}>
      <Sidebar admin={admin} />
      <div className="app__main">
        <header className="topbar">
          <div className="topbar__brand"><Brand size={28} /></div>
          <nav className="crumbs" aria-label="Ruta">
            <span>Agricola Moncopulli</span><span className="crumbs__sep">›</span><b>{seccion}</b>
          </nav>
          <div className="topbar__right">
            <span className="topbar__date">{dmy(new Date())}</span>
            {admin && (
              <div className="notifications">
                <button type="button" className="icon-btn notifications__toggle" aria-label={`Notificaciones${notificaciones.noLeidas ? `, ${notificaciones.noLeidas} sin leer` : ''}`}
                  aria-expanded={notificacionesAbiertas} onClick={() => setNotificacionesAbiertas((abierto) => !abierto)}>
                  <Bell size={20} strokeWidth={1.75} />
                  {notificaciones.noLeidas > 0 && <span className="notifications__badge">{notificaciones.noLeidas > 9 ? '9+' : notificaciones.noLeidas}</span>}
                </button>
                {notificacionesAbiertas && (
                  <section className="notifications__panel" aria-label="Notificaciones">
                    <header className="notifications__head">
                      <h2>Notificaciones</h2>
                      <button type="button" className="link-btn" disabled={!notificaciones.noLeidas} onClick={notificaciones.marcarLeidas}>Marcar leídas</button>
                    </header>
                    {notificaciones.error && (
                      <div className="notifications__error" role="alert">
                        <span>{notificaciones.error}</span>
                        <button type="button" className="link-btn" onClick={notificaciones.actualizar}>Reintentar</button>
                      </div>
                    )}
                    {notificaciones.notificaciones.length === 0 ? (
                      <p className="notifications__empty">No hay notificaciones nuevas.</p>
                    ) : (
                      <ul className="notifications__list">
                        {notificaciones.notificaciones.map((item) => (
                          <li key={item.id}>
                            <button type="button" className={`notifications__item ${item.leida ? '' : 'notifications__item--unread'}`}
                              onClick={() => { notificaciones.marcarLeidas(); setNotificacionesAbiertas(false); navigate('/historial') }}>
                              <span className="notifications__dot" aria-hidden="true" />
                              <span>
                                <b>{item.nombre}</b> registró {item.cantidad} {item.unidad} de <b>{item.producto}</b>
                                <small>{new Date(item.fecha).toLocaleString('es-CL')}</small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="notifications__hint">Se revisan nuevos consumos mientras la aplicación está abierta.</p>
                  </section>
                )}
              </div>
            )}
            <span className="vr" />
            <UserMenu usuario={usuario} admin={admin} onLogout={salir} />
          </div>
        </header>
        {(!online || pendientes.length > 0) && (
          <div className="offline" role="status">
            <WifiOff size={16} strokeWidth={1.75} />
            {!online ? 'Sin conexión. Puedes seguir registrando retiros: se enviarán cuando vuelva internet.' : 'Enviando retiros pendientes…'}
            {pendientes.length > 0 && <b>{pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}</b>}
          </div>
        )}
        <main className="content"><Outlet /></main>
      </div>
      <BarraInferior admin={admin} onLogout={salir} />
    </div>
  )
}
