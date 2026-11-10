import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, ChartNoAxesColumn, ChevronDown, CircleHelp, LayoutGrid, LogOut, MapPin, Menu, Package,
  Settings, Sprout, Truck, Users, WifiOff,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { dmy, esAdmin, iniciales } from '../lib/format'
import { sincronizarPendientes } from '../api/services'
import { useNotificaciones } from '../api/notifications'
import { useOnline, usePendientes } from '../api/hooks'
import { useToast } from './Toast'
import { Avatar } from './ui'

const GESTION = [
  { to: '/resumen', label: 'Resumen', icon: LayoutGrid, admin: true },
  { to: '/stock', label: 'Stock', icon: Package },
  { to: '/usuarios', label: 'Usuarios', icon: Users, admin: true },
  { to: '/inventario', label: 'Inventario', icon: Package, admin: true },
  { to: '/reportes', label: 'Reportes', icon: ChartNoAxesColumn, admin: true },
  { to: '/proveedores', label: 'Proveedores', icon: Truck, admin: true },
]
const PIE = [
  { to: '/ayuda', label: 'Ayuda', icon: CircleHelp },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]
const TITULOS = {
  '/resumen': 'Resumen', '/stock': 'Stock', '/usuarios': 'Usuarios', '/inventario': 'Inventario',
  '/reportes': 'Reportes', '/proveedores': 'Proveedores', '/ayuda': 'Ayuda', '/configuracion': 'Configuración',
}

export function Brand({ size = 34 }) {
  return (
    <div className="brand">
      <span className="brand__mark" style={{ width: size, height: size }}><Sprout size={size * 0.6} strokeWidth={1.75} /></span>
      <span className="brand__word">Moncopulli</span>
    </div>
  )
}

function Sidebar({ admin, abierto, cerrar }) {
  const item = (n) => (
    <NavLink key={n.to} to={n.to} onClick={cerrar} className={({ isActive }) => `nav__item ${isActive ? 'nav__item--active' : ''}`}>
      <n.icon size={20} strokeWidth={1.75} />
      {n.label}
    </NavLink>
  )
  return (
    <>
      {abierto && <div className="scrim" onClick={cerrar} />}
      <aside className={`sidebar ${abierto ? 'sidebar--open' : ''}`} aria-label="Menú principal">
        <div className="sidebar__brand"><Brand /></div>
        <div className="sidebar__scroll">
          <div className="overline">Gestión</div>
          <nav className="nav">{GESTION.filter((n) => admin || !n.admin).map(item)}</nav>
        </div>
        <div className="sidebar__foot">
          <nav className="nav">{PIE.filter((n) => admin || !n.admin).map(item)}</nav>
          <div className="place">
            <Avatar tone="primary"><MapPin size={14} strokeWidth={1.75} /></Avatar>
            <div><b>Agricola Moncopulli</b><span>Los Lagos, Chile</span></div>
          </div>
        </div>
      </aside>
    </>
  )
}

function UserMenu({ usuario, admin }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
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
          <button type="button" role="menuitem" onClick={() => { logout(); navigate('/login') }}>
            <LogOut size={16} strokeWidth={1.75} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { usuario } = useAuth()
  const admin = esAdmin(usuario)
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)
  const online = useOnline()
  const pendientes = usePendientes()
  const toast = useToast()
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false)
  const notificaciones = useNotificaciones(admin ? usuario : null)
  const seccion = TITULOS[pathname] ?? ''

  useEffect(() => setMenu(false), [pathname])

  useEffect(() => {
    if (!online || !pendientes.length) return
    sincronizarPendientes().then((n) => n && toast(`${n} ${n === 1 ? 'retiro sincronizado' : 'retiros sincronizados'}`))
  }, [online, pendientes.length === 0])

  return (
    <div className={`app ${admin ? '' : 'app--worker'}`}>
      <Sidebar admin={admin} abierto={menu} cerrar={() => setMenu(false)} />
      <div className="app__main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar__menu" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={22} strokeWidth={1.75} /></button>
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
                              onClick={() => { notificaciones.marcarLeidas(); setNotificacionesAbiertas(false); navigate('/reportes') }}>
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
            <UserMenu usuario={usuario} admin={admin} />
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
    </div>
  )
}
