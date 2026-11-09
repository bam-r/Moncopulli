import { useState } from 'react'
import { dmy, miles } from '../lib/format'

function useTip() {
  const [tip, setTip] = useState(null)
  const show = (e, contenido) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ x: Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90), y: r.top, contenido })
  }
  const hide = () => setTip(null)
  const el = tip && <div className="tip" style={{ left: tip.x, top: tip.y }} role="tooltip">{tip.contenido}</div>
  return { show, hide, el }
}

function escala(max) {
  const pow = 10 ** Math.floor(Math.log10(max || 1)) / 10
  for (let k = 0; k < 2; k++) {
    for (const m of [1, 2, 2.5, 5]) {
      const paso = m * pow * 10 ** k
      if (max / paso <= 5) return { paso, tope: Math.max(paso, Math.ceil(max / paso) * paso) }
    }
  }
  return { paso: pow * 10, tope: pow * 10 }
}

export function GraficoCard({ titulo, nota, accion, tabla, children, vacio }) {
  const [verTabla, setVerTabla] = useState(false)
  return (
    <section className="card chart-card">
      <header className="chart-card__head">
        <div>
          <h2>{titulo}</h2>
          {nota && <p className="sub">{nota}</p>}
        </div>
        <div className="chart-card__actions">
          {accion}
          {tabla && !vacio && (
            <button type="button" className="link-btn" onClick={() => setVerTabla(!verTabla)} aria-pressed={verTabla}>
              {verTabla ? 'Ver gráfico' : 'Ver tabla'}
            </button>
          )}
        </div>
      </header>
      {vacio ? (
        <div className="chart-empty">{vacio}</div>
      ) : verTabla && tabla ? (
        <div className="table-wrap table-wrap--flush">
          <table className="table table--compact">
            <thead><tr>{tabla.columnas.map((c, i) => <th key={c} className={i ? 'right' : ''}>{c}</th>)}</tr></thead>
            <tbody>{tabla.filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className={j ? 'right' : ''}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </section>
  )
}

export function BarList({ items }) {
  const { show, hide, el } = useTip()
  const max = Math.max(...items.map((i) => i.valor), 1)
  return (
    <>
      <ul className="bars">
        {items.map((i) => (
          <li key={i.key} className="bars__row" tabIndex={0} aria-label={`${i.label}: ${i.texto}. ${i.detalle ?? ''}`}
            onPointerEnter={(e) => show(e, <><b>{i.texto}</b><span>{i.label}</span>{i.detalle && <span>{i.detalle}</span>}</>)} onPointerLeave={hide}
            onFocus={(e) => show(e, <><b>{i.texto}</b><span>{i.label}</span>{i.detalle && <span>{i.detalle}</span>}</>)} onBlur={hide}>
            <div className="bars__head"><span className="bars__label">{i.label}</span><span className="bars__value">{i.texto}</span></div>
            <div className="bars__track"><span className="bars__fill" style={{ width: `${Math.max(2, (i.valor / max) * 100)}%` }} /></div>
            {i.detalle && <div className="sub">{i.detalle}</div>}
          </li>
        ))}
      </ul>
      {el}
    </>
  )
}

export function ColumnChart({ datos, unidad }) {
  const { show, hide, el } = useTip()
  const max = Math.max(...datos.map((d) => d.valor), 1)
  const { paso, tope } = escala(max)
  const ticks = []
  for (let t = 0; t <= tope; t += paso) ticks.push(t)
  const cadaN = Math.max(1, Math.ceil(datos.length / 7))
  const diaMes = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  const contenido = (d) => <><b>{miles(d.valor)} {unidad}</b><span>{dmy(d.fecha)}</span></>
  return (
    <div className="cols" role="img" aria-label={`Gráfico de columnas por día, máximo ${miles(max)} ${unidad}. Los datos están disponibles con "Ver tabla".`}>
      <div className="cols__plot">
        {ticks.map((t) => (
          <div key={t} className="cols__tick" style={{ bottom: `${(t / tope) * 100}%` }}><span>{miles(t)}</span></div>
        ))}
        <div className="cols__bars">
          {datos.map((d) => (
            <div key={d.fecha.getTime()} className="cols__slot" tabIndex={0}
              onPointerEnter={(e) => show(e, contenido(d))} onPointerLeave={hide} onFocus={(e) => show(e, contenido(d))} onBlur={hide}>
              <span className="cols__bar" style={{ height: `${(d.valor / tope) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="cols__x">
        {datos.map((d, i) => <span key={d.fecha.getTime()}>{i % cadaN === 0 ? diaMes(d.fecha) : ''}</span>)}
      </div>
      {el}
    </div>
  )
}
