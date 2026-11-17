import { Minus, Plus } from 'lucide-react'

// Cantidad con botones grandes: se puede escribir o tocar − / +.
export default function Cantidad({ value, onChange, unidad, max, id, 'aria-describedby': describedBy }) {
  const entera = ['UN', 'ROLLO', 'ROLLOS', 'BOLOS', 'SACOS', 'CAJAS'].includes(String(unidad).toUpperCase())
  const n = Number(value) || 0
  const poner = (v) => {
    let x = Math.max(0, v)
    if (max != null) x = Math.min(x, max)
    onChange(String(Math.round(x * 100) / 100))
  }
  const rapidos = entera ? [1, 2, 5, 10] : [1, 5, 10, 50]
  return (
    <div className="qty">
      <div className="qty__row">
        <button type="button" className="qty__btn" onClick={() => poner(n - 1)} disabled={n <= 0} aria-label="Restar uno"><Minus size={28} strokeWidth={2.5} /></button>
        <div className="qty__field">
          <input id={id} className="qty__input" type="number" inputMode="decimal" min="0" step={entera ? '1' : '0.01'} placeholder="0" aria-describedby={describedBy}
            value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />
          <span className="qty__unit">{unidad}</span>
        </div>
        <button type="button" className="qty__btn" onClick={() => poner(n + 1)} disabled={max != null && n >= max} aria-label="Sumar uno"><Plus size={28} strokeWidth={2.5} /></button>
      </div>
      <div className="qty__quick" role="group" aria-label="Sumar rápido">
        {rapidos.map((r) => (
          <button type="button" key={r} className="chip-btn" onClick={() => poner(n + r)} disabled={max != null && n >= max}>+{r}</button>
        ))}
        <button type="button" className="chip-btn" onClick={() => onChange('')} disabled={!value}>Borrar</button>
      </div>
    </div>
  )
}
