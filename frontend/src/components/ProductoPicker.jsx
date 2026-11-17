import { useMemo, useState } from 'react'
import { Check, Search, Star, X } from 'lucide-react'
import { estadoStock } from '../lib/stock'
import { sinTildes } from '../lib/analisis'
import { num } from '../lib/format'

const POR_PAGINA = 48

// Buscador de insumos para cuando hay muchos: texto + categorías + "mis frecuentes".
// Sirve igual para el retiro (consumo), para la compra y para ver la variación de precio en reportes.
export default function ProductoPicker({
  productos,
  onSelect,
  seleccionadoId,
  frecuentes = [],
  stockDe,
  sinStockBloquea = false,
  autoFocus = false,
  renderDetalle,
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [pagina, setPagina] = useState(1)

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'es')), [productos])
  const cantidadDe = (p) => (stockDe ? stockDe(p) : Number(p.stock_actual))

  const lista = useMemo(() => {
    const t = sinTildes(q).trim().split(/\s+/).filter(Boolean)
    const fav = new Map(frecuentes.map((id, i) => [id, i]))
    let r = productos.filter((p) => {
      if (cat === '__fav') { if (!fav.has(p.id)) return false } else if (cat && p.categoria !== cat) return false
      if (!t.length) return true
      const texto = sinTildes(`${p.nombre} ${p.codigo} ${p.categoria}`)
      return t.every((x) => texto.includes(x))
    })
    r = [...r].sort((a, b) => {
      if (cat === '__fav') return fav.get(a.id) - fav.get(b.id)
      const fa = fav.has(a.id) ? 0 : 1, fb = fav.has(b.id) ? 0 : 1
      return !q && !cat && fa !== fb ? fa - fb : a.nombre.localeCompare(b.nombre, 'es')
    })
    return r
  }, [productos, q, cat, frecuentes])

  const visibles = lista.slice(0, pagina * POR_PAGINA)
  const elegirCat = (c) => { setCat(c); setPagina(1) }

  return (
    <div className="picker">
      <div className="picker__search">
        <Search size={24} strokeWidth={2} aria-hidden="true" />
        <input className="input input--xl" type="search" aria-label="Buscar insumo" placeholder="Buscar por nombre, código o categoría" autoFocus={autoFocus}
          value={q} onChange={(e) => { setQ(e.target.value); setPagina(1) }} />
        {q && <button type="button" className="icon-btn picker__clear" onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={22} /></button>}
      </div>

      <div className="chips" role="group" aria-label="Filtrar por categoría">
        <button type="button" className={`chip-btn ${!cat ? 'chip-btn--on' : ''}`} aria-pressed={!cat} onClick={() => elegirCat('')}>Todos</button>
        {frecuentes.length > 0 && (
          <button type="button" className={`chip-btn ${cat === '__fav' ? 'chip-btn--on' : ''}`} aria-pressed={cat === '__fav'} onClick={() => elegirCat('__fav')}>
            <Star size={16} /> Mis frecuentes
          </button>
        )}
        {categorias.map((c) => (
          <button type="button" key={c} className={`chip-btn ${cat === c ? 'chip-btn--on' : ''}`} aria-pressed={cat === c} onClick={() => elegirCat(c)}>{c}</button>
        ))}
      </div>

      <p className="picker__count" aria-live="polite">{lista.length} {lista.length === 1 ? 'insumo' : 'insumos'}{q || cat ? ' encontrados' : ''}</p>

      {lista.length === 0 ? (
        <div className="picker__empty">No encontramos insumos con esa búsqueda. Prueba con otra palabra o quita el filtro.</div>
      ) : (
        <ul className="picker__grid">
          {visibles.map((p) => {
            const e = renderDetalle ? 'ok' : estadoStock({ ...p, stock_actual: cantidadDe(p) })
            const sel = String(seleccionadoId) === String(p.id)
            const bloqueado = sinStockBloquea && cantidadDe(p) <= 0
            return (
              <li key={p.id}>
                <button type="button" className={`pcard pcard--${e} ${sel ? 'pcard--sel' : ''}`} onClick={() => onSelect(p)} disabled={bloqueado} aria-pressed={sel}>
                  <span className="pcard__name">{p.nombre}</span>
                  <span className="pcard__meta">{p.codigo} · {p.categoria}</span>
                  <span className="pcard__stock">
                    {renderDetalle ? renderDetalle(p) : (
                      <>
                        {e === 'sin' ? 'Sin stock' : <><b>{num(cantidadDe(p))}</b> {p.unidad_medida}</>}
                        {e === 'bajo' && <em>Stock bajo</em>}
                      </>
                    )}
                  </span>
                  {sel && <span className="pcard__check" aria-hidden="true"><Check size={18} strokeWidth={3} /></span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {visibles.length < lista.length && (
        <button type="button" className="btn btn--secondary btn--lg btn--block" onClick={() => setPagina(pagina + 1)}>
          Mostrar más ({lista.length - visibles.length} restantes)
        </button>
      )}
    </div>
  )
}
