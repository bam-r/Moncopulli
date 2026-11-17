import { request, NetworkError } from './client'
import { agregarPendiente, leerPendientes, quitarPendiente, EVENTO_DATOS } from './pending'

const comoLista = (d) => (Array.isArray(d) ? d : d?.results ?? [])

export const listar = (recurso) => request('GET', `/${recurso}/`).then(comoLista)
export const obtener = (recurso, id) => request('GET', `/${recurso}/${id}/`)
export const crear = (recurso, datos) => request('POST', `/${recurso}/`, datos)
export const actualizar = (recurso, id, datos) => request('PATCH', `/${recurso}/${id}/`, datos)

// El login lo valida Django (compara contra la contraseña con hash).
export const iniciarSesion = (rut, contrasena) => request('POST', '/auth/login/', { rut, contrasena })
export const usuarioActual = () => request('GET', '/auth/me/')
export const cerrarSesion = () => request('POST', '/auth/logout/')
export const exportarDatos = () => request('GET', '/user/data-export/')
export const actualizarPerfil = (datos) => request('PATCH', '/user/profile/', datos)
export const cambiarContrasena = (datos) => request('PATCH', '/user/password/', datos)
export const leerPreferencias = () => request('GET', '/user/preferences/')
export const actualizarPreferencias = (datos) => request('PATCH', '/user/preferences/', datos)
export const eliminarCuenta = (contrasena_actual) =>
  request('DELETE', '/user/account/', { contrasena_actual })

// Anular un consumo: Django pone la fecha, devuelve el stock a su bodega y exige un administrador.
export async function anularConsumo(id, { motivo, usuario }) {
  const resultado = await actualizar('consumos', id, { estado: 'ANULADO', motivo_anulacion: motivo, usuario_anula: usuario })
  window.dispatchEvent(new Event(EVENTO_DATOS))
  return resultado
}

// Registrar una salida = crear un Consumo. Django descuenta el stock de esa bodega y pone la fecha.
// Sin internet queda en cola (con la hora en que se hizo) y se envía al volver la conexión.
export async function registrarSalida({ producto, bodega, usuario, cantidad }) {
  const cuerpo = {
    cantidad_retirada: Number(cantidad).toFixed(2),
    usuario,
    producto,
    bodega,
  }
  if (!navigator.onLine) {
    agregarPendiente({ ...cuerpo, fecha_offline: new Date().toISOString() })
    return { enCola: true }
  }
  try {
    const consumo = await crear('consumos', cuerpo)
    window.dispatchEvent(new Event(EVENTO_DATOS))
    return { enCola: false, consumo }
  } catch (e) {
    if (e instanceof NetworkError) {
      agregarPendiente({ ...cuerpo, fecha_offline: new Date().toISOString() })
      return { enCola: true }
    }
    throw e
  }
}

export async function sincronizarPendientes(usuarioId) {
  let enviados = 0
  for (const c of leerPendientes().filter((item) => String(item.usuario) === String(usuarioId))) {
    const { _local, ...cuerpo } = c
    try {
      await crear('consumos', cuerpo)
      quitarPendiente(_local)
      enviados += 1
    } catch (e) {
      if (e instanceof NetworkError) break
      quitarPendiente(_local) // el servidor lo rechazó (p. ej. sin stock): no reintentar siempre
    }
  }
  if (enviados) window.dispatchEvent(new Event(EVENTO_DATOS))
  return enviados
}

// Una compra se envía completa (cabecera + líneas) y Django la guarda de una vez;
// él suma el stock en la bodega del documento.
export async function registrarCompra({ cabecera, lineas }) {
  const doc = await crear('documentos-compra', {
    ...cabecera,
    detalles: lineas.map((l) => ({
      producto: Number(l.producto),
      cantidad: Number(l.cantidad).toFixed(2),
      precio_unitario: Math.round(Number(l.precio_unitario)),
    })),
  })
  window.dispatchEvent(new Event(EVENTO_DATOS))
  return doc
}

// Un inventario también se envía completo; Django calcula "stock en sistema" y desviación de esa bodega.
export async function registrarInventario({ cabecera, lineas }) {
  return crear('inventarios', {
    ...cabecera,
    detalles: lineas.map((l) => ({ producto: Number(l.producto), stock_real: Number(l.stock_real).toFixed(2) })),
  })
}

export const anularInventario = (id, { motivo, usuario }) =>
  actualizar('inventarios', id, {
    estado: 'ANULADO',
    motivo_anulacion: motivo,
    usuario_anula: usuario,
  })
