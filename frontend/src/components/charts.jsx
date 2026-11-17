import { useState } from 'react'
import { dmy, miles, pesos } from '../lib/format'

function useTip() {
  const [tip, setTip] = useState(null)
  const show = (e, contenido) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ x: Math.min(Math.max(r.left + r.width / 2, 110), window.innerWidth - 110), y: r.top, contenido })
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

function escalaRango(minVal, maxVal) {
  if (minVal === maxVal) {
    const margen = Math.max(10, Math.round(maxVal * 0.1))
    return { base: Math.max(0, minVal - margen), tope: maxVal + margen, paso: margen / 2 }
  }
  const span = maxVal - minVal
  const pad = Math.max(span * 0.2, maxVal * 0.03, 1)
  const rawMin = Math.max(0, minVal - pad)
  const rawMax = maxVal + pad
  const { paso } = escala(rawMax - rawMin)
  const base = Math.max(0, Math.floor(rawMin / paso) * paso)
  const tope = Math.max(base + paso, Math.ceil(rawMax / paso) * paso)
  return { base, tope, paso }
}

export function GraficoCard({ titulo, nota, accion, tabla, children, vacio, id }) {
  const [verTabla, setVerTabla] = useState(false)
  return (
    <section id={id} className="card chart-card">
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

const fmt = (v) => (Number.isInteger(v) ? miles(v) : (Math.round(v * 100) / 100).toLocaleString('es-CL'))
const diaMes = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

export function ColumnChart({ datos, unidad, fechaTexto = dmy, semanal = false }) {
  const { show, hide, el } = useTip()
  const max = Math.max(...datos.map((d) => d.valor), 1)
  const { paso, tope } = escala(max)
  const ticks = []
  for (let t = 0; t <= tope; t += paso) ticks.push(t)
  const cadaN = Math.max(1, Math.ceil(datos.length / 7))
  const contenido = (d) => <><b>{fmt(d.valor)} {unidad}</b><span>{semanal ? 'Semana del ' : ''}{fechaTexto(d.fecha)}</span></>
  return (
    <div className="cols" role="img" aria-label={`Gráfico de columnas por día, máximo ${fmt(max)} ${unidad}. Los datos están disponibles con "Ver tabla".`}>
      <div className="cols__plot">
        {ticks.map((t) => (
          <div key={t} className="cols__tick" style={{ bottom: `${(t / tope) * 100}%` }}><span>{fmt(t)}</span></div>
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

export function LineChart({ datos, unidad = '' }) {
  const { show, hide, el } = useTip()
  if (!datos?.length) return null
  const valores = datos.map((d) => d.valor)
  const { base, tope, paso } = escalaRango(Math.min(...valores), Math.max(...valores))
  const rango = Math.max(tope - base, 1)
  const ticks = []
  for (let t = base; t <= tope + paso * 0.01; t += paso) ticks.push(Math.round(t))

  const xPct = (i) => (datos.length === 1 ? 50 : 6 + (i / (datos.length - 1)) * 88)
  const yPct = (v) => ((v - base) / rango) * 100
  const puntosSvg = datos.map((d, i) => `${(xPct(i) * 6).toFixed(1)},${(220 - yPct(d.valor) * 2.2).toFixed(1)}`).join(' ')
  const areaSvg = datos.length > 1
    ? `${(xPct(0) * 6).toFixed(1)},220 ${puntosSvg} ${(xPct(datos.length - 1) * 6).toFixed(1)},220`
    : ''

  const cadaN = Math.max(1, Math.ceil(datos.length / 8))
  const contenido = (d) => (
    <>
      <b>{pesos(d.valor)}{unidad ? ` / ${unidad}` : ''}</b>
      {d.diffPct != null && (
        <span>
          {d.diffPct > 0 ? '+' : ''}{d.diffPct.toFixed(1).replace('.', ',')}% ({d.diffPesos >= 0 ? '+' : '−'}{pesos(Math.abs(d.diffPesos))}) vs anterior
        </span>
      )}
      {d.detalle && <span>{d.detalle}</span>}
      <span>{dmy(d.fecha)}</span>
    </>
  )

  return (
    <div className="cols line-chart" role="img" aria-label="Gráfico de línea de evolución de precio unitario en cada compra.">
      <div className="cols__plot">
        {ticks.map((t) => (
          <div key={t} className="cols__tick" style={{ bottom: `${((t - base) / rango) * 100}%` }}>
            <span>${fmt(t)}</span>
          </div>
        ))}
        <svg className="line-chart__svg" viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">
          {areaSvg && <polygon className="line-chart__area" points={areaSvg} />}
          {datos.length > 1 && <polyline className="line-chart__line" points={puntosSvg} />}
        </svg>
        {datos.map((d, i) => (
          <button
            type="button"
            key={d.key ?? i}
            className={`line-chart__point ${d.diffPct > 0 ? 'line-chart__point--up' : d.diffPct < 0 ? 'line-chart__point--down' : ''}`}
            style={{ left: `${xPct(i)}%`, bottom: `${yPct(d.valor)}%` }}
            aria-label={`Compra del ${dmy(d.fecha)}: ${pesos(d.valor)}`}
            onPointerEnter={(e) => show(e, contenido(d))}
            onPointerLeave={hide}
            onFocus={(e) => show(e, contenido(d))}
            onBlur={hide}
          >
            <span className="line-chart__val">{pesos(d.valor)}</span>
          </button>
        ))}
      </div>
      <div className="cols__x line-chart__x">
        {datos.map((d, i) => (
          <span key={d.key ?? i} style={{ left: `${xPct(i)}%` }}>
            {i % cadaN === 0 || i === datos.length - 1 ? diaMes(d.fecha) : ''}
          </span>
        ))}
      </div>
      {el}
    </div>
  )
}
