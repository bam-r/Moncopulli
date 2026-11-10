import { request, ApiError, NetworkError } from './client'
import { agregarPendiente, leerPendientes, quitarPendiente, EVENTO_DATOS } from './pending'
import { cleanRut, formatRut } from '../lib/rut'

const comoLista = (d) => (Array.isArray(d) ? d : d?.results ?? [])

export const listar = (recurso) => request('GET', `/${recurso}/`).then(comoLista)
export const obtener = (recurso, id) => request('GET', `/${recurso}/${id}/`)
export const crear = (recurso, datos) => request('POST', `/${recurso}/`, datos)
export const actualizar = (recurso, id, datos) => request('PATCH', `/${recurso}/${id}/`, datos)

export async function iniciarSesion(rut, contrasena) {
  const usuarios = await listar('usuarios')


  const u = usuarios.find((x) => cleanRut(x.rut) === cleanRut(rut ?? ''))
  if (!u || !contrasena || (u.contrasena !== undefined && u.contrasena !== contrasena)) {
    throw new ApiError(400, { detail: 'RUT o contraseña incorrectos.' })
  }
  if (!String(u.estado).toLowerCase().startsWith('activ')) {
    throw new ApiError(403, { detail: 'Tu usuario está inactivo. Contacta al administrador.' })
  }
  return { usuario: u }
}

async function ajustarStockProducto(productoId, delta) {
  const prod = await obtener('productos', Number(productoId))
  const nuevoStock = Math.max(0, Number(prod.stock_actual) + Number(delta)).toFixed(2)
  return actualizar('productos', prod.id, { stock_actual: nuevoStock })
}

export async function anularConsumo(id, { motivo, usuario }) {
  const previo = await obtener('consumos', id)
  const resultado = await actualizar('consumos', id, {
    estado: 'ANULADO',
    motivo_anulacion: motivo,
    fecha_anulacion: new Date().toISOString(),
    usuario_anula: usuario,
  })
  if (!String(previo.estado).toLowerCase().startsWith('anul')) {
    await ajustarStockProducto(resultado.producto, Number(resultado.cantidad_retirada))
  }
  window.dispatchEvent(new Event(EVENTO_DATOS))
  return resultado
}

export async function registrarSalida({ producto, bodega, usuario, cantidad }) {
  const cuerpo = {
    fecha: new Date().toISOString(),
    cantidad_retirada: Number(cantidad).toFixed(2),
    estado: 'CONFIRMADO',
    usuario,
    producto,
    bodega,
  }
  if (!navigator.onLine) {
    agregarPendiente(cuerpo)
    return { enCola: true }
  }
  try {
    const prod = await obtener('productos', Number(producto))
    if (Number(cantidad) > Number(prod.stock_actual)) {
      throw new ApiError(400, { cantidad_retirada: ['Supera el stock disponible.'] })
    }
    await crear('consumos', cuerpo)
    await actualizar('productos', prod.id, {
      stock_actual: Math.max(0, Number(prod.stock_actual) - Number(cantidad)).toFixed(2),
    })
    return { enCola: false }
  } catch (e) {
    if (e instanceof NetworkError) {
      agregarPendiente(cuerpo)
      return { enCola: true }
    }
    throw e
  }
}

export async function sincronizarPendientes() {
  let enviados = 0
  for (const c of leerPendientes()) {
    const { _local, ...cuerpo } = c
    try {
      await crear('consumos', cuerpo)
      await ajustarStockProducto(cuerpo.producto, -Number(cuerpo.cantidad_retirada))
      quitarPendiente(_local)
      enviados += 1
    } catch (e) {
      if (e instanceof NetworkError) break
      quitarPendiente(_local)
    }
  }
  if (enviados) window.dispatchEvent(new Event(EVENTO_DATOS))
  return enviados
}

export async function registrarCompra({ cabecera, lineas }) {
  const doc = await crear('documentos-compra', cabecera)
  for (const l of lineas) {
    await crear('detalle-documentos', {
      documento: doc.id,
      producto: Number(l.producto),
      cantidad: Number(l.cantidad).toFixed(2),
      precio_unitario: Math.round(Number(l.precio_unitario)),
    })
    await ajustarStockProducto(l.producto, Number(l.cantidad))
  }
  if (cabecera.proveedor && cabecera.fecha_emision) {
    try {
      await actualizar('proveedores', Number(cabecera.proveedor), { ultima_compra: cabecera.fecha_emision })
    } catch {}
  }
  return doc
}

export async function registrarInventario({ cabecera, lineas }) {
  const inv = await crear('inventarios', cabecera)
  for (const l of lineas) {
    await crear('detalle-inventarios', {
      inventario: inv.id,
      producto: Number(l.producto),
      stock_sistema: Number(l.stock_sistema).toFixed(2),
      stock_real: Number(l.stock_real).toFixed(2),
      desviacion: (Number(l.stock_real) - Number(l.stock_sistema)).toFixed(2),
    })
  }
  return inv
}

export const anularInventario = (id, { motivo, usuario }) =>
  actualizar('inventarios', id, {
    estado: 'ANULADO',
    motivo_anulacion: motivo,
    fecha_anulacion: new Date().toISOString(),
    usuario_anula: usuario,
  })
