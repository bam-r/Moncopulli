import { useState } from 'react'
import { Button, Field, Modal, Select } from './ui'
import { actualizar, crear } from '../api/services'
import { useToast } from './Toast'
import { formatRut, isValidRut } from '../lib/rut'

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function useEnvio(onSaved, onClose) {
  const [enviando, setEnviando] = useState(false)
  const [errorServidor, setError] = useState('')
  const enviar = async (fn, mensaje) => {
    setEnviando(true); setError('')
    try {
      const r = await fn()
      onSaved?.(r)
      onClose(r)
    } catch (e) {
      setError(e.message || 'No se pudo guardar')
    } finally { setEnviando(false) }
    return mensaje
  }
  return { enviando, errorServidor, enviar }
}

function Pie({ onClose, enviando, etiqueta, formId, error }) {
  return (
    <>
      {error && <span className="hint hint--error modal__error" role="alert">{error}</span>}
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <button type="submit" form={formId} className="btn btn--primary" disabled={enviando}>{enviando ? 'Guardando…' : etiqueta}</button>
    </>
  )
}

export function InsumoModal({ productos, bodegas = [], onClose, onSaved }) {
  const toast = useToast()
  const activas = bodegas.filter((b) => b.estado !== false)
  const [f, setF] = useState({ codigo: '', nombre: '', categoria: '', unidad_medida: '', costo_promedio: '', stock_actual: '0', stock_minimo: '', bodega: activas[0]?.id ?? '' })
  const [err, setErr] = useState({})
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const categorias = [...new Set(productos.map((p) => p.categoria))]
  const unidades = [...new Set(productos.map((p) => p.unidad_medida))]
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const n = {}
    if (!f.codigo.trim()) n.codigo = 'Ingresa un código.'
    if (!f.nombre.trim()) n.nombre = 'Ingresa el nombre.'
    if (!f.categoria.trim()) n.categoria = 'Ingresa la categoría.'
    if (!f.unidad_medida.trim()) n.unidad_medida = 'Ingresa la unidad.'
    if (f.costo_promedio === '' || Number(f.costo_promedio) < 0) n.costo_promedio = 'Ingresa el costo.'
    if (f.stock_minimo === '' || Number(f.stock_minimo) < 0) n.stock_minimo = 'Ingresa el mínimo.'
    if (f.stock_actual === '' || Number(f.stock_actual) < 0) n.stock_actual = 'Ingresa el stock inicial.'
    if (Number(f.stock_actual) > 0 && !f.bodega) n.bodega = 'Elige en qué bodega queda el stock inicial.'
    setErr(n)
    if (Object.keys(n).length) return
    enviar(async () => {
      const r = await crear('productos', {
        codigo: f.codigo.trim().toUpperCase(), nombre: f.nombre.trim(), categoria: f.categoria.trim(),
        unidad_medida: f.unidad_medida.trim().toUpperCase(),
        costo_promedio: Number(f.costo_promedio).toFixed(2), stock_actual: Number(f.stock_actual).toFixed(2), stock_minimo: Number(f.stock_minimo).toFixed(2),
        ...(Number(f.stock_actual) > 0 ? { bodega_inicial: Number(f.bodega) } : {}),
      })
      toast('Insumo añadido')
      return r
    })
  }

  return (
    <Modal title="Añadir insumo" onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Añadir insumo" formId="f-insumo" error={errorServidor} />}>
      <form id="f-insumo" className="form" onSubmit={submit} noValidate>
        <div className="form__row">
          <Field label="Código" error={err.codigo} hint="Ej. AGR-003">{(id) => <input id={id} className="input" maxLength={20} value={f.codigo} onChange={set('codigo')} />}</Field>
          <Field label="Nombre" error={err.nombre}>{(id) => <input id={id} className="input" maxLength={100} value={f.nombre} onChange={set('nombre')} />}</Field>
        </div>
        <div className="form__row">
          <Field label="Categoría" error={err.categoria}>{(id) => (<><input id={id} className="input" list="dl-cat" maxLength={50} value={f.categoria} onChange={set('categoria')} /><datalist id="dl-cat">{categorias.map((c) => <option key={c} value={c} />)}</datalist></>)}</Field>
          <Field label="Unidad de medida" error={err.unidad_medida} hint="Ej. LTS, KG, BOLOS">{(id) => (<><input id={id} className="input" list="dl-uni" maxLength={20} value={f.unidad_medida} onChange={set('unidad_medida')} /><datalist id="dl-uni">{unidades.map((c) => <option key={c} value={c} />)}</datalist></>)}</Field>
        </div>
        <div className="form__row form__row--3">
          <Field label="Costo promedio ($)" error={err.costo_promedio}>{(id) => <input id={id} className="input" type="number" inputMode="decimal" step="0.01" min="0" value={f.costo_promedio} onChange={set('costo_promedio')} />}</Field>
          <Field label="Stock inicial" error={err.stock_actual}>{(id) => <input id={id} className="input" type="number" inputMode="decimal" step="0.01" min="0" value={f.stock_actual} onChange={set('stock_actual')} />}</Field>
          <Field label="Stock mínimo" error={err.stock_minimo}>{(id) => <input id={id} className="input" type="number" inputMode="decimal" step="0.01" min="0" value={f.stock_minimo} onChange={set('stock_minimo')} />}</Field>
        </div>
        {Number(f.stock_actual) > 0 && (
          <Field label="Bodega del stock inicial" error={err.bodega}>
            {(id) => <Select id={id} value={f.bodega} onChange={set('bodega')}>{activas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</Select>}
          </Field>
        )}
      </form>
    </Modal>
  )
}

export function UsuarioModal({ usuario, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(() => usuario
    ? { ...usuario, contrasena: '' }
    : { rut: '', nombre_completo: '', puesto: '', departamento: '', telefono: '', email: '', contrasena: '', rol: 'TRABAJADOR', estado: 'Activo' })
  const [err, setErr] = useState({})
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const n = {}
    if (!isValidRut(f.rut)) n.rut = 'RUT inválido. Incluye el dígito verificador.'
    if (!f.nombre_completo.trim()) n.nombre_completo = 'Ingresa el nombre completo.'
    if (!f.puesto.trim()) n.puesto = 'Ingresa el puesto.'
    if (!f.departamento.trim()) n.departamento = 'Ingresa el departamento.'
    if (!f.telefono.trim()) n.telefono = 'Ingresa un teléfono.'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) n.email = 'Correo inválido.'
    if ((!usuario || f.contrasena) && f.contrasena.length < 6) n.contrasena = 'Mínimo 6 caracteres.'
    setErr(n)
    if (Object.keys(n).length) return
    enviar(async () => {
      const datos = {
        rut: f.rut,
        nombre_completo: f.nombre_completo.trim(),
        puesto: f.puesto.trim(),
        departamento: f.departamento.trim(),
        telefono: f.telefono.trim(),
        email: f.email.trim(),
        rol: f.rol,
        estado: f.estado,
      }
      if (f.contrasena) datos.contrasena = f.contrasena
      const r = usuario ? await actualizar('usuarios', usuario.id, datos) : await crear('usuarios', { ...datos, contrasena: f.contrasena })
      toast(usuario ? 'Usuario actualizado' : 'Usuario añadido')
      return r
    })
  }

  return (
    <Modal title={usuario ? 'Editar usuario' : 'Añadir usuario'} onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta={usuario ? 'Guardar cambios' : 'Añadir usuario'} formId="f-usuario" error={errorServidor} />}>
      <form id="f-usuario" className="form" onSubmit={submit} noValidate>
        <div className="form__row">
          <Field label="RUT" error={err.rut} hint="Incluye el dígito verificador.">{(id) => <input id={id} className="input" inputMode="text" placeholder="Ej. 12.345.678-9" value={f.rut} onChange={(e) => setF({ ...f, rut: formatRut(e.target.value) })} />}</Field>
          <Field label="Nombre completo" error={err.nombre_completo}>{(id) => <input id={id} className="input" maxLength={100} value={f.nombre_completo} onChange={set('nombre_completo')} />}</Field>
        </div>
        <div className="form__row">
          <Field label="Puesto" error={err.puesto}>{(id) => <input id={id} className="input" maxLength={50} value={f.puesto} onChange={set('puesto')} />}</Field>
          <Field label="Departamento" error={err.departamento}>{(id) => <input id={id} className="input" maxLength={50} value={f.departamento} onChange={set('departamento')} />}</Field>
        </div>
        <div className="form__row">
          <Field label="Teléfono" error={err.telefono}>{(id) => <input id={id} className="input" type="tel" maxLength={15} value={f.telefono} onChange={set('telefono')} />}</Field>
          <Field label="Correo" error={err.email}>{(id) => <input id={id} className="input" type="email" maxLength={80} value={f.email} onChange={set('email')} />}</Field>
        </div>
        <div className="form__row form__row--3">
          <Field label={usuario ? 'Nueva contraseña (opcional)' : 'Contraseña'} error={err.contrasena} hint={usuario ? 'Déjala vacía para conservar la contraseña actual.' : undefined}>{(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={f.contrasena} onChange={set('contrasena')} />}</Field>
          <Field label="Rol">{(id) => <Select id={id} value={f.rol} onChange={set('rol')}><option value="TRABAJADOR">Trabajador</option><option value="ADMIN">Administrador</option></Select>}</Field>
          <Field label="Estado">{(id) => <Select id={id} value={f.estado} onChange={set('estado')}><option>Activo</option><option>Inactivo</option></Select>}</Field>
        </div>
      </form>
    </Modal>
  )
}
