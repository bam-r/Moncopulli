import { useEffect, useId } from 'react'
import { ChevronDown, X } from 'lucide-react'

export function Button({ variant = 'primary', block, icon: Icon, children, className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn--${variant} ${block ? 'btn--block' : ''} ${className}`} {...rest}>
      {Icon && <Icon size={16} strokeWidth={1.75} />}
      {children}
    </button>
  )
}

export function LinkButton({ icon: Icon, children, ...rest }) {
  return (
    <button type="button" className="link-btn" {...rest}>
      {Icon && <Icon size={16} strokeWidth={1.75} />}
      {children}
    </button>
  )
}

const TONOS_ICONO = { primary: 'tile--primary', warning: 'tile--warning', danger: 'tile--danger', neutral: 'tile--neutral' }

export function StatCard({ icon: Icon, tone = 'primary', label, value, note, title, className = '' }) {
  return (
    <div className={`card stat ${className}`}>
      <span className={`tile ${TONOS_ICONO[tone]}`}><Icon size={22} strokeWidth={1.75} /></span>
      <div className="stat__body">
        {title ? <div className="stat__title">{title}</div> : <div className="stat__label">{label}</div>}
        {title ? (
          <div className="stat__note">{note}</div>
        ) : (
          <div className="stat__line">
            <span className="stat__value">{value}</span>
            <span className="stat__note">{note}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function Badge({ tone, children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Avatar({ children, tone }) {
  return <span className={`avatar ${tone === 'primary' ? 'avatar--primary' : ''}`}>{children}</span>
}

export function Field({ label, hint, error, children }) {
  const id = useId()
  return (
    <div className="field">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      {typeof children === 'function' ? children(id) : children}
      {error ? <span className="hint hint--error" role="alert">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Select({ children, className = '', ...rest }) {
  return (
    <span className={`select ${className}`}>
      <select {...rest}>{children}</select>
      <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
    </span>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', f)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', f); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, crumb, actions }) {
  return (
    <div className="page-head">
      <div className="page-head__text">
        <nav className="crumbs crumbs--page" aria-label="Ruta">
          <span>Agricola Moncopulli</span><span className="crumbs__sep">›</span><b>{crumb ?? title}</b>
        </nav>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  )
}

export function Estado({ cargando, error, vacio }) {
  if (cargando) return <div className="state">Cargando…</div>
  if (error) return <div className="state state--error">No se pudo cargar la información. {error}</div>
  if (vacio) return <div className="state">{vacio}</div>
  return null
}
