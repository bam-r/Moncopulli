import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Field, Modal, Select } from './ui'
import { actualizar, crear, registrarCompra, registrarSalida } from '../api/services'
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

export function SalidaModal({ productos, bodegas: todas, usuario, onClose, onSaved }) {
  const toast = useToast()
  const bodegas = todas.filter((b) => b.estado !== false)
  const disponibles = productos.filter((p) => Number(p.stock_actual) > 0)
  const [f, setF] = useState({ producto: '', cantidad: '', bodega: bodegas[0]?.id ?? '' })
  const [err, setErr] = useState({})
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)
  const prod = productos.find((p) => String(p.id) === String(f.producto))

  const submit = (e) => {
    e.preventDefault()
    const nuevo = {}
    if (!f.producto) nuevo.producto = 'Elige un insumo.'
    const cant = Number(f.cantidad)
    if (!(cant > 0)) nuevo.cantidad = 'Ingresa una cantidad mayor a 0.'
    else if (prod && cant > Number(prod.stock_actual)) nuevo.cantidad = `Solo hay ${num(prod.stock_actual)} ${prod.unidad_medida} disponibles.`
    if (!f.bodega) nuevo.bodega = 'Elige una bodega.'
    setErr(nuevo)
    if (Object.keys(nuevo).length) return
    enviar(async () => {
      const r = await registrarSalida({ producto: Number(f.producto), bodega: Number(f.bodega), usuario: usuario.id, cantidad: cant })
      toast(r.enCola ? 'Sin conexión: el retiro quedó guardado y se enviará solo.' : 'Salida registrada', r.enCola ? 'cola' : 'ok')
      return r
    })
  }

  return (
    <Modal title="Registrar salida" onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Registrar salida" formId="f-salida" error={errorServidor} />}>
      <form id="f-salida" className="form" onSubmit={submit} noValidate>
        <Field label="Insumo" error={err.producto}>
          {(id) => (
            <Select id={id} value={f.producto} onChange={(e) => setF({ ...f, producto: e.target.value })}>
              <option value="">Selecciona un insumo</option>
              {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>)}
            </Select>
          )}
        </Field>
        <Field label={`Cantidad${prod ? ` (${prod.unidad_medida})` : ''}`} error={err.cantidad} hint={prod ? `Disponible: ${num(prod.stock_actual)} ${prod.unidad_medida}` : undefined}>
          {(id) => <input id={id} className="input" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0,00" value={f.cantidad} onChange={(e) => setF({ ...f, cantidad: e.target.value })} />}
        </Field>
        <Field label="Bodega" error={err.bodega}>
          {(id) => (
            <Select id={id} value={f.bodega} onChange={(e) => setF({ ...f, bodega: e.target.value })}>
              {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  )
}

export function CompraModal({ productos, proveedores: todosProv, bodegas: todas, usuario, onClose, onSaved }) {
  const toast = useToast()
  const bodegas = todas.filter((b) => b.estado !== false)
  const proveedores = todosProv.filter((p) => p.estado !== false)
  const [c, setC] = useState({ proveedor: '', bodega: bodegas[0]?.id ?? '', tipo_documento: 'Factura', numero_folio: '', fecha_emision: hoyISO() })
  const [lineas, setLineas] = useState([{ producto: '', cantidad: '', precio_unitario: '' }])
  const [err, setErr] = useState({})
  const { enviando, errorServidor, enviar } = useEnvio(onSaved, onClose)

  const setLinea = (i, k, v) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const total = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.precio_unitario || 0), 0)

  const submit = (e) => {
    e.preventDefault()
    const nuevo = {}
    if (!c.proveedor) nuevo.proveedor = 'Elige un proveedor.'
    if (!c.numero_folio.trim()) nuevo.numero_folio = 'Ingresa el N° de folio.'
    if (!c.fecha_emision) nuevo.fecha_emision = 'Ingresa la fecha.'
    if (lineas.some((l) => !l.producto || !(Number(l.cantidad) > 0) || !(Number(l.precio_unitario) >= 0) || l.precio_unitario === '')) nuevo.lineas = 'Completa insumo, cantidad y precio en cada línea.'
    setErr(nuevo)
    if (Object.keys(nuevo).length) return
    enviar(async () => {
      const r = await registrarCompra({
        cabecera: { ...c, numero_folio: c.numero_folio.trim(), proveedor: Number(c.proveedor), bodega: Number(c.bodega), usuario: usuario.id },
        lineas,
      })
      toast('Compra agregada')
      return r
    })
  }

  return (
    <Modal title="Agregar compra" onClose={onClose} footer={<Pie onClose={onClose} enviando={enviando} etiqueta="Guardar compra" formId="f-compra" error={errorServidor} />}>
      <form id="f-compra" className="form" onSubmit={submit} noValidate>
        <div className="form__row">
          <Field label="Proveedor" error={err.proveedor}>
            {(id) => (
              <Select id={id} value={c.proveedor} onChange={(e) => setC({ ...c, proveedor: e.target.value })}>
                <option value="">Selecciona</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Bodega">
            {(id) => (
              <Select id={id} value={c.bodega} onChange={(e) => setC({ ...c, bodega: e.target.value })}>
                {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <div className="form__row form__row--3">
          <Field label="Tipo de documento">
            {(id) => (
              <Select id={id} value={c.tipo_documento} onChange={(e) => setC({ ...c, tipo_documento: e.target.value })}>
                <option>Factura</option><option>Boleta</option><option>Guía de despacho</option>
              </Select>
            )}
          </Field>
          <Field label="N° de folio" error={err.numero_folio}>
            {(id) => <input id={id} className="input" maxLength={20} value={c.numero_folio} onChange={(e) => setC({ ...c, numero_folio: e.target.value })} />}
          </Field>
          <Field label="Fecha de emisión" error={err.fecha_emision}>
            {(id) => <input id={id} className="input" type="date" value={c.fecha_emision} onChange={(e) => setC({ ...c, fecha_emision: e.target.value })} />}
          </Field>
        </div>

        <div className="lines">
          <div className="label">Insumos comprados</div>
          {lineas.map((l, i) => {
            const p = productos.find((x) => String(x.id) === String(l.producto))
            return (
              <div className="line" key={i}>
                <Select aria-label="Insumo" value={l.producto} onChange={(e) => setLinea(i, 'producto', e.target.value)}>
                  <option value="">Insumo</option>
                  {productos.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.codigo})</option>)}
                </Select>
                <input className="input" aria-label={`Cantidad${p ? ` (${p.unidad_medida})` : ''}`} type="number" inputMode="decimal" step="0.01" min="0" placeholder={p ? `Cant. (${p.unidad_medida})` : 'Cantidad'} value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} />
                <input className="input" aria-label="Precio unitario" type="number" inputMode="numeric" step="1" min="0" placeholder="Precio unit. ($)" value={l.precio_unitario} onChange={(e) => setLinea(i, 'precio_unitario', e.target.value)} />
                <button type="button" className="icon-btn" aria-label="Quitar línea" disabled={lineas.length === 1} onClick={() => setLineas(lineas.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
              </div>
            )
          })}
          {err.lineas && <span className="hint hint--error" role="alert">{err.lineas}</span>}
          <div className="lines__foot">
            <button type="button" className="link-btn" onClick={() => setLineas([...lineas, { producto: '', cantidad: '', precio_unitario: '' }])}><Plus size={16} /> Agregar otra línea</button>
            <span className="lines__total">Total: <b>${Math.round(total).toLocaleString('es-CL')}</b></span>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function InsumoModal({ productos, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ codigo: '', nombre: '', categoria: '', unidad_medida: '', costo_promedio: '', stock_actual: '0', stock_minimo: '' })
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
    setErr(n)
    if (Object.keys(n).length) return
    enviar(async () => {
      const r = await crear('productos', {
        codigo: f.codigo.trim().toUpperCase(), nombre: f.nombre.trim(), categoria: f.categoria.trim(),
        unidad_medida: f.unidad_medida.trim().toUpperCase(),
        costo_promedio: Number(f.costo_promedio).toFixed(2), stock_actual: Number(f.stock_actual).toFixed(2), stock_minimo: Number(f.stock_minimo).toFixed(2),
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
