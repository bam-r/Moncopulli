import { useMemo, useState } from 'react'
import { Button, Field, Modal, Select } from './ui'
import { actualizar, anularInventario, anularConsumo, crear, registrarInventario } from '../api/services'
import { useToast } from './Toast'
import { formatRut, isValidRut } from '../lib/rut'
import { num } from '../lib/format'

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function useEnvio(onSaved, onClose) {
  const [enviando, setEnviando] = useState(false)
  const [errorServidor, setError] = useState('')
  const enviar = async (fn) => {
    setEnviando(true); setError('')
    try { const r = await fn(); onSaved?.(r); onClose() } catch (e) { setError(e.message || 'No se pudo guardar') } finally { setEnviando(false) }
  }
  return { enviando, errorServidor, enviar }
}

function Pie({ onClose, enviando, etiqueta, formId, error, peligro }) {
  return (
    <>
      {error && <span className="hint hint--error modal__error" role="alert">{error}</span>}
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <button type="submit" form={formId} className={`btn ${peligro ? 'btn--danger' : 'btn--primary'}`} disabled={enviando}>{enviando ? 'Guardando…' : etiqueta}</button>
    </>
  )
}

const activas = (bodegas) => bodegas.filter((b) => b.estado !== false)

export function InventarioModal({ productos, bodegas, usuario, onClose, onSaved }) {
  const toast = useToast()
  const lista = activas(bodegas)
  const [cab, setCab] = useState({ bodega: lista[0]?.id ?? '', fecha: hoyISO() })
  const [reales, setReales] = useState({})
  const [err, setErr] = useState('')
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)

  const contados = useMemo(() => productos.filter((p) => reales[p.id] !== undefined && reales[p.id] !== ''), [productos, reales])

  const submit = (e) => {
    e.preventDefault()
    if (!cab.bodega) return setErr('Elige una bodega.')
    if (!cab.fecha) return setErr('Ingresa la fecha.')
    if (!contados.length) return setErr('Anota el stock real de al menos un insumo.')
    if (contados.some((p) => Number(reales[p.id]) < 0)) return setErr('El stock real no puede ser negativo.')
    setErr('')
    enviar(async () => {
      const r = await registrarInventario({
        cabecera: { fecha: cab.fecha, estado: 'CONFIRMADO', usuario: usuario.id, bodega: Number(cab.bodega) },
        lineas: contados.map((p) => ({ producto: p.id, stock_sistema: p.stock_actual, stock_real: reales[p.id] })),
      })
      toast('Inventario registrado')
      return r
    })
  }

  return (
    <Modal title="Registrar inventario" wide onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Guardar inventario" formId="f-inv" error={err || errorServidor} />}>
      <form id="f-inv" className="form" onSubmit={submit} noValidate>
        <div className="form__row">
          <Field label="Bodega">{(id) => <Select id={id} value={cab.bodega} onChange={(e) => setCab({ ...cab, bodega: e.target.value })}>{lista.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</Select>}</Field>
          <Field label="Fecha del conteo">{(id) => <input id={id} className="input" type="date" value={cab.fecha} onChange={(e) => setCab({ ...cab, fecha: e.target.value })} />}</Field>
        </div>
        <div className="count">
          <div className="count__head"><span>Insumo</span><span className="right">En sistema</span><span className="right">Stock real</span><span className="right">Diferencia</span></div>
          {productos.map((p) => {
            const real = reales[p.id]
            const dif = real === undefined || real === '' ? null : Number(real) - Number(p.stock_actual)
            return (
              <div className="count__row" key={p.id}>
                <span><span className="name">{p.nombre}</span><span className="sub">{p.codigo}</span></span>
                <span className="right">{num(p.stock_actual)} {p.unidad_medida}</span>
                <input className="input" type="number" inputMode="decimal" step="0.01" min="0" aria-label={`Stock real de ${p.nombre}`} placeholder="—" value={real ?? ''} onChange={(e) => setReales({ ...reales, [p.id]: e.target.value })} />
                <span className={`right diff ${dif < 0 ? 'diff--neg' : ''}`}>{dif === null ? '' : `${dif > 0 ? '+' : ''}${num(dif)}`}</span>
              </div>
            )
          })}
        </div>
        <p className="hint">Solo se guardan los insumos con stock real anotado. Guardar el inventario no modifica el stock actual.</p>
      </form>
    </Modal>
  )
}

export function AnularModal({ inventario, usuario, onClose, onSaved }) {
  const toast = useToast()
  const [motivo, setMotivo] = useState('')
  const [err, setErr] = useState('')
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const submit = (e) => {
    e.preventDefault()
    if (motivo.trim().length < 5) return setErr('Cuenta brevemente el motivo (mínimo 5 letras).')
    setErr('')
    enviar(async () => { const r = await anularInventario(inventario.id, { motivo: motivo.trim(), usuario: usuario.id }); toast('Inventario anulado'); return r })
  }
  return (
    <Modal title="Anular inventario" onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Anular inventario" formId="f-anular" error={errorServidor} peligro />}>
      <form id="f-anular" className="form" onSubmit={submit} noValidate>
        <p className="muted">El inventario no se borra: queda registrado como anulado, con el motivo, la fecha y quién lo anuló. Esta acción no se puede deshacer.</p>
        <Field label="Motivo de la anulación" error={err}>
          {(id) => <textarea id={id} className="input textarea" rows={3} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  )
}

export function AnularConsumoModal({ consumo, descripcion, usuario, onClose, onSaved }) {
  const toast = useToast()
  const [motivo, setMotivo] = useState('')
  const [err, setErr] = useState('')
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const submit = (e) => {
    e.preventDefault()
    if (motivo.trim().length < 5) return setErr('Cuenta brevemente el motivo (mínimo 5 caracteres).')
    setErr('')
    enviar(async () => {
      const resultado = await anularConsumo(consumo.id, { motivo: motivo.trim(), usuario: usuario.id })
      toast('Consumo anulado')
      return resultado
    })
  }
  return (
    <Modal title="Anular consumo" onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Anular consumo" formId="f-anular-consumo" error={errorServidor || err} peligro />}>
      <form id="f-anular-consumo" className="form" onSubmit={submit} noValidate>
        <p className="muted">{descripcion}. El consumo quedará registrado como anulado y se excluirá de los reportes. Esta acción no se puede deshacer.</p>
        <Field label="Motivo de la anulación" error={err}>
          {(id) => <textarea id={id} className="input textarea" rows={3} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  )
}

export function LecheModal({ usuario, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ fecha: hoyISO(), litros: '', observacion: '' })
  const [err, setErr] = useState({})
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const submit = (e) => {
    e.preventDefault()
    const n = {}
    if (!f.fecha) n.fecha = 'Ingresa la fecha.'
    if (!(Number(f.litros) > 0)) n.litros = 'Ingresa los litros (mayor a 0).'
    setErr(n)
    if (Object.keys(n).length) return
    enviar(async () => {
      const r = await crear('produccion-leche', { fecha: f.fecha, litros: Number(f.litros).toFixed(2), observacion: f.observacion.trim() || null, usuario: usuario.id })
      toast('Producción registrada')
      return r
    })
  }
  return (
    <Modal title="Registrar producción de leche" onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Guardar" formId="f-leche" error={errorServidor} />}>
      <form id="f-leche" className="form" onSubmit={submit} noValidate>
        <div className="form__row">
          <Field label="Fecha" error={err.fecha}>{(id) => <input id={id} className="input" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />}</Field>
          <Field label="Litros" error={err.litros}>{(id) => <input id={id} className="input" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0,00" value={f.litros} onChange={(e) => setF({ ...f, litros: e.target.value })} />}</Field>
        </div>
        <Field label="Observación (opcional)">{(id) => <input id={id} className="input" maxLength={200} value={f.observacion} onChange={(e) => setF({ ...f, observacion: e.target.value })} />}</Field>
      </form>
    </Modal>
  )
}

export function ProveedorModal({ proveedor, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(() => proveedor
    ? {
      ...proveedor,
      plazo_pago: String(proveedor.plazo_pago ?? 30),
      limite_credito: String(proveedor.limite_credito ?? 0),
    }
    : { razon_social: '', nombre: '', rut: '', domicilio_legal: '', telefono: '', correo: '', contacto: '', plazo_pago: '30', limite_credito: '0', categoria: '' })
  const [err, setErr] = useState({})
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = (e) => {
    e.preventDefault()
    const n = {}
    if (!f.razon_social.trim()) n.razon_social = 'Ingresa la razón social.'
    if (!f.nombre.trim()) n.nombre = 'Ingresa el nombre.'
    if (!isValidRut(f.rut)) n.rut = 'RUT inválido. Incluye el dígito verificador.'
    if (!f.domicilio_legal.trim()) n.domicilio_legal = 'Ingresa el domicilio.'
    if (!f.telefono.trim()) n.telefono = 'Ingresa un teléfono.'
    if (!/^\S+@\S+\.\S+$/.test(f.correo)) n.correo = 'Correo inválido.'
    if (!f.contacto.trim()) n.contacto = 'Ingresa un contacto.'
    if (!f.categoria.trim()) n.categoria = 'Ingresa la categoría.'
    if (f.plazo_pago === '' || Number(f.plazo_pago) < 0) n.plazo_pago = 'Ingresa los días.'
    if (f.limite_credito === '' || Number(f.limite_credito) < 0) n.limite_credito = 'Ingresa el límite.'
    setErr(n)
    if (Object.keys(n).length) return
    enviar(async () => {
      const t = (k) => f[k].trim()
      const datos = {
        razon_social: t('razon_social'), nombre: t('nombre'), rut: f.rut, domicilio_legal: t('domicilio_legal'), telefono: t('telefono'), correo: t('correo'), contacto: t('contacto'),
        plazo_pago: Math.round(Number(f.plazo_pago)), limite_credito: Math.round(Number(f.limite_credito)), categoria: t('categoria'),
      }
      const r = proveedor
        ? await actualizar('proveedores', proveedor.id, datos)
        : await crear('proveedores', { ...datos, estado: true })
      toast(proveedor ? 'Proveedor actualizado' : 'Proveedor añadido')
      return r
    })
  }
  const campo = (k, label, extra = {}) => <Field label={label} error={err[k]} hint={extra.hint}>{(id) => <input id={id} className="input" value={f[k]} onChange={set(k)} {...extra.input} />}</Field>
  return (
    <Modal title={proveedor ? 'Editar proveedor' : 'Añadir proveedor'} wide onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta={proveedor ? 'Guardar cambios' : 'Añadir proveedor'} formId="f-prov" error={errorServidor} />}>
      <form id="f-prov" className="form" onSubmit={submit} noValidate>
        <div className="form__row">{campo('nombre', 'Nombre', { input: { maxLength: 100 } })}{campo('razon_social', 'Razón social', { input: { maxLength: 100 } })}</div>
        <div className="form__row">
          <Field label="RUT" error={err.rut} hint="Incluye el dígito verificador.">{(id) => <input id={id} className="input" placeholder="Ej. 76.123.456-7" value={f.rut} onChange={(e) => setF({ ...f, rut: formatRut(e.target.value) })} />}</Field>
          {campo('categoria', 'Categoría', { input: { maxLength: 50 }, hint: 'Ej. Agroquímicos, Fertilizantes' })}
        </div>
        {campo('domicilio_legal', 'Domicilio legal', { input: { maxLength: 150 } })}
        <div className="form__row">{campo('contacto', 'Persona de contacto', { input: { maxLength: 100 } })}{campo('telefono', 'Teléfono', { input: { type: 'tel', maxLength: 15 } })}</div>
        {campo('correo', 'Correo', { input: { type: 'email', maxLength: 80 } })}
        <div className="form__row">
          {campo('plazo_pago', 'Plazo de pago (días)', { input: { type: 'number', min: 0, step: 1, inputMode: 'numeric' } })}
          {campo('limite_credito', 'Límite de crédito ($)', { input: { type: 'number', min: 0, step: 1, inputMode: 'numeric' } })}
        </div>
      </form>
    </Modal>
  )
}

export function BodegaModal({ onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ nombre: '', ubicacion: '' })
  const [err, setErr] = useState({})
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const submit = (e) => {
    e.preventDefault()
    const n = {}
    if (!f.nombre.trim()) n.nombre = 'Ingresa el nombre.'
    if (!f.ubicacion.trim()) n.ubicacion = 'Ingresa la ubicación.'
    setErr(n)
    if (Object.keys(n).length) return
    enviar(async () => { const r = await crear('bodegas', { nombre: f.nombre.trim(), ubicacion: f.ubicacion.trim(), estado: true }); toast('Bodega añadida'); return r })
  }
  return (
    <Modal title="Añadir bodega" onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Añadir bodega" formId="f-bod" error={errorServidor} />}>
      <form id="f-bod" className="form" onSubmit={submit} noValidate>
        <Field label="Nombre" error={err.nombre}>{(id) => <input id={id} className="input" maxLength={80} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />}</Field>
        <Field label="Ubicación" error={err.ubicacion}>{(id) => <input id={id} className="input" maxLength={150} value={f.ubicacion} onChange={(e) => setF({ ...f, ubicacion: e.target.value })} />}</Field>
      </form>
    </Modal>
  )
}
