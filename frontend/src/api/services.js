import { request, NetworkError } from './client'
import { agregarPendiente, leerPendientes, quitarPendiente, EVENTO_DATOS } from './pending'

const comoLista = (d) => (Array.isArray(d) ? d : d?.results ?? [])

export const listar = (recurso) => request('GET', `/${recurso}/`).then(comoLista)
export const crear = (recurso, datos) => request('POST', `/${recurso}/`, datos)
export const actualizar = (recurso, id, datos) => request('PATCH', `/${recurso}/${id}/`, datos)

export const iniciarSesion = (rut, contrasena) => request('POST', '/auth/login/', { rut, contrasena })

export async function anularConsumo(id, { motivo, usuario }) {
  const resultado = await actualizar('consumos', id, {
    estado: 'ANULADO',
    motivo_anulacion: motivo,
    fecha_anulacion: new Date().toISOString(),
    usuario_anula: usuario,
  })
  window.dispatchEvent(new Event(EVENTO_DATOS))
  return resultado
}

export async function registrarSalida({ producto, bodega, usuario, cantidad }) {
  const cuerpo = {
    fecha: new Date().toISOString(),
    cantidad_retirada: Number(cantidad).toFixed(2),
    estado: 'CONFIRMADO',
    usuario, producto, bodega,
  }
  if (!navigator.onLine) { agregarPendiente(cuerpo); return { enCola: true } }
  try {
    await crear('consumos', cuerpo)
    return { enCola: false }
  } catch (e) {
    if (e instanceof NetworkError) { agregarPendiente(cuerpo); return { enCola: true } }
    throw e
  }
}

export async function sincronizarPendientes() {
  let enviados = 0
  for (const c of leerPendientes()) {
    const { _local, ...cuerpo } = c
    try {
      await crear('consumos', cuerpo)
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
