import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CircleCheck, Lock, Plus, ShoppingCart, Trash2, TriangleAlert, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useAhora, useRecursos } from '../api/hooks'
import { registrarCompra } from '../api/services'
import { Estado, Field, Modal, PageHeader, Select } from '../components/ui'
import ProductoPicker from '../components/ProductoPicker'
import { useToast } from '../components/Toast'
import { fechaLarga, horaCompleta, num, pesos } from '../lib/format'

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const TIPOS = ['Factura', 'Boleta', 'Guía de despacho']

export default function RegistrarCompra() {
  const { usuario } = useAuth()
  const toast = useToast()
  const ahora = useAhora()
  const { data, loading, error, reload } = useRecursos(['productos', 'proveedores', 'bodegas'])
  const [c, setC] = useState({ proveedor: '', bodega: '', tipo_documento: 'Factura', numero_folio: '', fecha_emision: hoyISO() })
  const [lineas, setLineas] = useState([]) // { producto, cantidad, precio_unitario }
  const [buscando, setBuscando] = useState(false)
  const [err, setErr] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [hecho, setHecho] = useState(null)

  const proveedores = (data.proveedores ?? []).filter((p) => p.estado !== false)
  const bodegas = (data.bodegas ?? []).filter((b) => b.estado !== false)
  const productos = data.productos ?? []
  const prod = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const bodegaId = c.bodega || bodegas[0]?.id || ''

  const total = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.precio_unitario || 0), 0)
  const setLinea = (id, k, v) => setLineas(lineas.map((l) => (l.producto === id ? { ...l, [k]: v } : l)))

  const agregar = (p) => {
    if (lineas.some((l) => l.producto === p.id)) {
      toast(`${p.nombre} ya está en la lista: ajusta su cantidad.`)
    } else {
      setLineas([...lineas, { producto: p.id, cantidad: '', precio_unitario: String(Math.round(Number(p.costo_promedio))) }])
    }
    setBuscando(false)
  }

  const validar = () => {
    const n = {}
    if (!c.proveedor) n.proveedor = 'Elige un proveedor.'
    if (!bodegaId) n.bodega = 'Elige la bodega donde queda lo comprado.'
    if (!c.numero_folio.trim()) n.numero_folio = 'Ingresa el N° del documento.'
    if (!c.fecha_emision) n.fecha_emision = 'Ingresa la fecha del documento.'
    if (!lineas.length) n.lineas = 'Agrega al menos un insumo.'
    else if (lineas.some((l) => !(Number(l.cantidad) > 0) || l.precio_unitario === '' || Number(l.precio_unitario) < 0)) n.lineas = 'Completa cantidad y precio en cada insumo.'
    setErr(n)
    return Object.keys(n).length === 0
  }

  const confirmar = async () => {
    if (!validar() || enviando) return
    setEnviando(true); setErrorEnvio('')
    try {
      const doc = await registrarCompra({
        cabecera: { ...c, bodega: Number(bodegaId), numero_folio: c.numero_folio.trim(), proveedor: Number(c.proveedor), usuario: usuario.id },
        lineas,
      })
      setHecho({ doc, proveedor: proveedores.find((p) => p.id === Number(c.proveedor)), bodega: bodegas.find((b) => b.id === Number(bodegaId)), total, n: lineas.length, tipo: c.tipo_documento, folio: c.numero_folio.trim() })
      toast('Compra registrada')
      setLineas([]); setC({ proveedor: '', bodega: '', tipo_documento: 'Factura', numero_folio: '', fecha_emision: hoyISO() })
      reload()
    } catch (e) {
      setErrorEnvio(e.message || 'No se pudo registrar la compra.')
    } finally { setEnviando(false) }
  }

  const cabecera = <PageHeader title="Registrar compra" subtitle="Anota el documento del proveedor y los insumos que llegaron. El stock sube en la bodega elegida." />
  if (loading && !data.productos) return <>{cabecera}<Estado cargando /></>
  if (error && !data.productos) return <>{cabecera}<Estado error={error} /></>

  if (hecho) {
    return (
      <>
        {cabecera}
        <section className="card hecho" role="status">
          <span className="hecho__icon"><CircleCheck size={44} strokeWidth={2} /></span>
          <h2>Compra registrada</h2>
          <p>El stock ya subió en {hecho.bodega?.nombre}.</p>
          <dl className="resumen-registro">
            <div><dt>Documento</dt><dd>{hecho.tipo} N° {hecho.folio}</dd></div>
            <div><dt>Proveedor</dt><dd>{hecho.proveedor?.nombre}</dd></div>
            <div><dt>Insumos</dt><dd>{hecho.n}</dd></div>
            <div><dt>Total</dt><dd>{pesos(hecho.total)}</dd></div>
            <div><dt>Registrado por</dt><dd>{usuario.nombre_completo}</dd></div>
          </dl>
          <div className="hecho__actions">
            <button type="button" className="btn btn--primary btn--xl" onClick={() => setHecho(null)}><ShoppingCart size={26} /> Registrar otra compra</button>
            <Link className="btn btn--secondary btn--lg" to="/historial">Ver historial</Link>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      {cabecera}
      <div className="compra">
        <div className="compra__main">
          <section className="card compra__card">
            <h2 className="paso"><span>1</span> Datos del documento</h2>
            <div className="form">
              <div className="form__row">
                <Field label="Proveedor" error={err.proveedor}>
                  {(id) => (
                    <Select id={id} value={c.proveedor} onChange={(e) => setC({ ...c, proveedor: e.target.value })}>
                      <option value="">Elige un proveedor</option>
                      {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Bodega donde queda" error={err.bodega}>
                  {(id) => (
                    <Select id={id} value={bodegaId} onChange={(e) => setC({ ...c, bodega: e.target.value })}>
                      {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
              <div className="form__row form__row--3">
                <Field label="Tipo de documento">
                  {(id) => <Select id={id} value={c.tipo_documento} onChange={(e) => setC({ ...c, tipo_documento: e.target.value })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</Select>}
                </Field>
                <Field label="N° del documento" error={err.numero_folio}>
                  {(id) => <input id={id} className="input" inputMode="numeric" maxLength={20} value={c.numero_folio} onChange={(e) => setC({ ...c, numero_folio: e.target.value })} />}
                </Field>
                <Field label="Fecha del documento" error={err.fecha_emision}>
                  {(id) => <input id={id} className="input" type="date" max={hoyISO()} value={c.fecha_emision} onChange={(e) => setC({ ...c, fecha_emision: e.target.value })} />}
                </Field>
              </div>
            </div>
          </section>

          <section className="card compra__card">
            <h2 className="paso"><span>2</span> Insumos comprados</h2>
            {lineas.length === 0 && <p className="compra__vacio">Todavía no agregas insumos.</p>}
            <ul className="lineas">
              {lineas.map((l) => {
                const p = prod.get(l.producto)
                return (
                  <li key={l.producto} className="linea-card">
                    <div className="linea-card__head">
                      <div><b>{p?.nombre}</b><span>{p?.codigo} · {p?.categoria}</span></div>
                      <button type="button" className="icon-btn" aria-label={`Quitar ${p?.nombre}`} onClick={() => setLineas(lineas.filter((x) => x.producto !== l.producto))}><Trash2 size={22} /></button>
                    </div>
                    <div className="linea-card__fields">
                      <label className="field">
                        <span className="label">Cantidad ({p?.unidad_medida})</span>
                        <input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={l.cantidad} onChange={(e) => setLinea(l.producto, 'cantidad', e.target.value)} />
                      </label>
                      <label className="field">
                        <span className="label">Precio unitario ($)</span>
                        <input className="input" type="number" inputMode="numeric" min="0" step="1" value={l.precio_unitario} onChange={(e) => setLinea(l.producto, 'precio_unitario', e.target.value)} />
                      </label>
                      <div className="linea-card__sub"><span>Subtotal</span><b>{pesos(Number(l.cantidad || 0) * Number(l.precio_unitario || 0))}</b></div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {err.lineas && <p className="msg msg--error" role="alert"><TriangleAlert size={20} /> {err.lineas}</p>}
            <button type="button" className="btn btn--secondary btn--lg btn--block" onClick={() => setBuscando(true)}><Plus size={24} /> Agregar insumo</button>
          </section>
        </div>

        <aside className="compra__side">
          <div className="card consumo__form">
            <h2 className="paso"><span>3</span> Revisa y confirma</h2>
            <div className="preview" aria-label="Vista previa del registro">
              <div className="preview__lock"><Lock size={16} /> Vista previa · estos datos los pone el sistema y no se pueden editar</div>
              <dl className="preview__list">
                <div><dt><CalendarClock size={18} /> Registrada el</dt><dd>{fechaLarga(ahora)}</dd></div>
                <div><dt><CalendarClock size={18} /> Hora</dt><dd className="mono">{horaCompleta(ahora)}</dd></div>
                <div><dt><UserRound size={18} /> Registrada por</dt><dd>{usuario.nombre_completo}</dd></div>
                <div><dt>Proveedor</dt><dd>{proveedores.find((p) => p.id === Number(c.proveedor))?.nombre ?? '—'}</dd></div>
                <div><dt>Bodega</dt><dd>{bodegas.find((b) => b.id === Number(bodegaId))?.nombre ?? '—'}</dd></div>
                <div><dt>Documento</dt><dd>{c.numero_folio ? `${c.tipo_documento} N° ${c.numero_folio}` : '—'}</dd></div>
                <div><dt>Insumos</dt><dd>{lineas.length}</dd></div>
                <div className="preview__total"><dt>Total</dt><dd>{pesos(total)}</dd></div>
              </dl>
            </div>
            {errorEnvio && <p className="msg msg--error" role="alert"><TriangleAlert size={20} /> {errorEnvio}</p>}
            <button type="button" className="btn btn--primary btn--xl btn--block" onClick={confirmar} disabled={enviando}>
              {enviando ? 'Guardando…' : <><CircleCheck size={28} /> Confirmar compra</>}
            </button>
          </div>
        </aside>
      </div>

      {buscando && (
        <Modal title="Agregar insumo" wide onClose={() => setBuscando(false)}>
          <ProductoPicker productos={productos} onSelect={agregar} autoFocus />
        </Modal>
      )}
    </>
  )
}
