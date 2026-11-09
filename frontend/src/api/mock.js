import { rutConDv, cleanRut } from '../lib/rut'
import { ApiError } from './client'

const KEY = 'moncopulli.mock.v2'
const min = 60000

function semilla() {
  const ahora = Date.now()
  const inicioHoy = new Date(); inicioHoy.setHours(0, 1, 0, 0)
  const hoy = (m) => new Date(Math.max(ahora - m * min, inicioHoy.getTime())).toISOString()
  const atras = (m) => new Date(ahora - m * min).toISOString()
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const u = (id, nombre, puesto, depto, rol, estado, pass, rutBody) => ({
    id, rut: rutConDv(rutBody), nombre_completo: nombre, puesto, departamento: depto,
    telefono: '+56 9 1234 5678', email: `${nombre.split(' ')[0].toLowerCase()}.${nombre.split(' ')[1][0].toLowerCase()}@moncopulli.cl`,
    contrasena: pass, rol, estado,
  })
  const db = {
    usuarios: [
      u(1, 'Administrador Moncopulli', 'Administrador', 'Gerencia', 'ADMIN', 'Activo', 'admin123', '11111111'),
      u(2, 'Pedro Soto', 'Lechero', 'Lechería', 'TRABAJADOR', 'Activo', 'trabajador123', '12345678'),
      u(3, 'Juan Pérez', 'Operario', 'Campo', 'TRABAJADOR', 'Activo', 'trabajador123', '15234567'),
      u(4, 'Carlos Muñoz', 'Tractorista', 'Campo', 'TRABAJADOR', 'Activo', 'trabajador123', '16789012'),
      u(5, 'Luis Gómez', 'Cuidador', 'Predio', 'TRABAJADOR', 'Inactivo', 'trabajador123', '13456789'),
      u(6, 'Miguel Silva', 'Lechero', 'Lechería', 'TRABAJADOR', 'Activo', 'trabajador123', '17890123'),
    ],
    proveedores: [
      { id: 1, razon_social: 'Comercial Agrocenter SpA', nombre: 'Comercial Agrocenter', rut: rutConDv('76123456'), domicilio_legal: 'Osorno', telefono: '+56 64 200 0000', correo: 'ventas@agrocenter.cl', contacto: 'Ventas', plazo_pago: 30, limite_credito: 5000000, ultima_compra: dia(0), categoria: 'Agroquímicos', estado: true },
      { id: 2, razon_social: 'Fertilizantes del Sur Ltda.', nombre: 'Fertilizantes del Sur', rut: rutConDv('77234567'), domicilio_legal: 'Osorno', telefono: '+56 64 211 1111', correo: 'contacto@fertisur.cl', contacto: 'Ventas', plazo_pago: 30, limite_credito: 3000000, ultima_compra: dia(3), categoria: 'Fertilizantes', estado: true },
    ],
    bodegas: [
      { id: 1, nombre: 'Bodega Principal', ubicacion: 'Predio Moncopulli', estado: true },
      { id: 2, nombre: 'Bodega de Forraje', ubicacion: 'Predio Moncopulli', estado: true },
    ],
    productos: [
      { id: 1, codigo: 'AGR-001', nombre: 'Cayenne', categoria: 'Agroquímicos', unidad_medida: 'LTS', costo_promedio: '15000.00', stock_actual: '25.00', stock_minimo: '20.00' },
      { id: 2, codigo: 'AGR-002', nombre: 'Engeo 247 ZC', categoria: 'Agroquímicos', unidad_medida: 'LTS', costo_promedio: '48000.00', stock_actual: '6.00', stock_minimo: '4.00' },
      { id: 3, codigo: 'CON-001', nombre: 'Power Growth', categoria: 'Concentrados', unidad_medida: 'KG', costo_promedio: '650.00', stock_actual: '8000.00', stock_minimo: '2000.00' },
      { id: 4, codigo: 'FER-002', nombre: 'Soluan 32', categoria: 'Fertilizantes', unidad_medida: 'LTS', costo_promedio: '900.00', stock_actual: '800.00', stock_minimo: '1000.00' },
      { id: 5, codigo: 'CON-003', nombre: 'Starter Plus', categoria: 'Concentrados', unidad_medida: 'KG', costo_promedio: '720.00', stock_actual: '250.00', stock_minimo: '50.00' },
      { id: 6, codigo: 'FOR-001', nombre: 'Bolos Paja', categoria: 'Forraje', unidad_medida: 'BOLOS', costo_promedio: '14000.00', stock_actual: '500.00', stock_minimo: '600.00' },
      { id: 7, codigo: 'FOR-002', nombre: 'Heno Alfalfa', categoria: 'Forraje', unidad_medida: 'BOLOS', costo_promedio: '18000.00', stock_actual: '0.00', stock_minimo: '100.00' },
    ],
    'documentos-compra': [
      { id: 1, numero_folio: '1001', tipo_documento: 'Factura', fecha_emision: dia(0), proveedor: 1, bodega: 1, usuario: 1 },
      { id: 2, numero_folio: '0987', tipo_documento: 'Factura', fecha_emision: dia(3), proveedor: 2, bodega: 1, usuario: 1 },
    ],
    'detalle-documentos': [
      { id: 1, cantidad: '20.00', precio_unitario: 15000, documento: 1, producto: 1 },
      { id: 2, cantidad: '500.00', precio_unitario: 900, documento: 2, producto: 4 },
    ],
    'produccion-leche': [],
    consumos: [
      { id: 1, fecha: hoy(12), cantidad_retirada: '10.00', estado: 'CONFIRMADO', motivo_anulacion: null, fecha_anulacion: null, usuario: 2, producto: 3, bodega: 1, usuario_anula: null },
      { id: 2, fecha: hoy(25), cantidad_retirada: '5.00', estado: 'CONFIRMADO', motivo_anulacion: null, fecha_anulacion: null, usuario: 3, producto: 5, bodega: 1, usuario_anula: null },
      { id: 3, fecha: hoy(40), cantidad_retirada: '2.00', estado: 'CONFIRMADO', motivo_anulacion: null, fecha_anulacion: null, usuario: 6, producto: 6, bodega: 2, usuario_anula: null },
      { id: 4, fecha: atras(26 * 60), cantidad_retirada: '5.00', estado: 'CONFIRMADO', motivo_anulacion: null, fecha_anulacion: null, usuario: 4, producto: 2, bodega: 1, usuario_anula: null },
      { id: 5, fecha: atras(5 * 24 * 60), cantidad_retirada: '2.00', estado: 'CONFIRMADO', motivo_anulacion: null, fecha_anulacion: null, usuario: 3, producto: 1, bodega: 1, usuario_anula: null },
    ],
    inventarios: [
      { id: 1, fecha: dia(3), estado: 'CONFIRMADO', motivo_anulacion: null, fecha_anulacion: null, usuario: 1, bodega: 1, usuario_anula: null },
    ],
    'detalle-inventarios': [
      { id: 1, stock_sistema: '30.00', stock_real: '29.00', desviacion: '-1.00', inventario: 1, producto: 1 },
      { id: 2, stock_sistema: '10.00', stock_real: '10.00', desviacion: '0.00', inventario: 1, producto: 2 },
      { id: 3, stock_sistema: '960.00', stock_real: '941.00', desviacion: '-19.00', inventario: 1, producto: 3 },
    ],
  }

  const usuariosCiclo = [2, 3, 4, 6]
  const consumoTipo = { 1: [2, 3], 2: [1, 2], 3: [200, 400], 4: [50, 100], 5: [20, 30], 6: [4, 8] }
  const prodCiclo = [3, 1, 4, 6, 5, 2, 3, 6, 4, 1, 5, 3, 6, 4]
  prodCiclo.forEach((pid, i) => {
    const [a, b] = consumoTipo[pid]
    db.consumos.push({
      id: 6 + i, fecha: atras((2 + i * 2) * 24 * 60 + 9 * 60), cantidad_retirada: (i % 2 ? b : a).toFixed(2), estado: 'CONFIRMADO',
      motivo_anulacion: null, fecha_anulacion: null, usuario: usuariosCiclo[i % 4], producto: pid, bodega: pid === 6 ? 2 : 1, usuario_anula: null,
    })
  })
  ;[[3, 2, 8, [[3, 4000, 650], [5, 300, 720]]], [4, 1, 15, [[2, 4, 48000], [1, 30, 15000]]], [5, 2, 22, [[6, 200, 14000], [4, 600, 900]]]].forEach(([id, prov, dias, lineas]) => {
    db['documentos-compra'].push({ id, numero_folio: String(1100 + id), tipo_documento: 'Factura', fecha_emision: dia(dias), proveedor: prov, bodega: 1, usuario: 1 })
    lineas.forEach(([producto, cantidad, precio]) => db['detalle-documentos'].push({ id: db['detalle-documentos'].length + 1, cantidad: cantidad.toFixed(2), precio_unitario: precio, documento: id, producto }))
  })
  for (let i = 0; i < 21; i++) {
    db['produccion-leche'].push({ id: i + 1, fecha: dia(i), litros: (1850 + ((i * 37) % 9) * 25 - (i % 5 === 0 ? 60 : 0)).toFixed(2), observacion: null, usuario: i % 2 ? 6 : 2 })
  }
  db.inventarios.push(
    { id: 2, fecha: dia(18), estado: 'CONFIRMADO', motivo_anulacion: null, fecha_anulacion: null, usuario: 1, bodega: 1, usuario_anula: null },
    { id: 3, fecha: dia(10), estado: 'ANULADO', motivo_anulacion: 'Conteo repetido por error de digitación', fecha_anulacion: atras(9 * 24 * 60), usuario: 1, bodega: 2, usuario_anula: 1 },
  )
  ;[[2, 1, 28, 27], [2, 2, 8, 7], [2, 4, 820, 790], [2, 5, 260, 260], [3, 6, 520, 480], [3, 7, 10, 10]].forEach(([inventario, producto, sis, real], i) =>
    db['detalle-inventarios'].push({ id: 4 + i, stock_sistema: sis.toFixed(2), stock_real: real.toFixed(2), desviacion: (real - sis).toFixed(2), inventario, producto }))
  return db
}

function cargar() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return semilla()
}
function guardar(db) { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch {} }

const sinClave = (u) => { const { contrasena, ...resto } = u; return resto }
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export async function mockRequest(method, path, body) {
  await espera(120)
  const db = cargar()
  const partes = path.split('/').filter(Boolean)

  if (partes[0] === 'auth' && partes[1] === 'login') {
    const u = db.usuarios.find((x) => cleanRut(x.rut) === cleanRut(body?.rut ?? ''))
    if (!u || u.contrasena !== body?.contrasena) throw new ApiError(400, { detail: 'RUT o contraseña incorrectos.' })
    if (!String(u.estado).toLowerCase().startsWith('activ')) throw new ApiError(403, { detail: 'Tu usuario está inactivo. Contacta al administrador.' })
    return { usuario: sinClave(u) }
  }

  const [recurso, id] = partes
  const tabla = db[recurso]
  if (!tabla) throw new ApiError(404, { detail: 'No encontrado.' })
  const out = (x) => (recurso === 'usuarios' ? sinClave(x) : x)

  if (method === 'GET') {
    if (id) {
      const fila = tabla.find((x) => x.id === Number(id))
      if (!fila) throw new ApiError(404, { detail: 'No encontrado.' })
      return out(fila)
    }
    return tabla.map(out)
  }

  if (method === 'POST') {
    const fila = { id: Math.max(0, ...tabla.map((x) => x.id)) + 1, ...body }
    if (recurso === 'consumos') {
      const p = db.productos.find((x) => x.id === Number(body.producto))
      if (!p) throw new ApiError(400, { producto: ['Insumo inválido.'] })
      if (Number(body.cantidad_retirada) > Number(p.stock_actual)) throw new ApiError(400, { cantidad_retirada: ['Supera el stock disponible.'] })
      p.stock_actual = (Number(p.stock_actual) - Number(body.cantidad_retirada)).toFixed(2)
      Object.assign(fila, { motivo_anulacion: null, fecha_anulacion: null, usuario_anula: null })
    }
    if (recurso === 'detalle-documentos') {
      const p = db.productos.find((x) => x.id === Number(body.producto))
      if (p) p.stock_actual = (Number(p.stock_actual) + Number(body.cantidad)).toFixed(2)
    }
    if (recurso === 'productos' && db.productos.some((x) => x.codigo === body.codigo)) throw new ApiError(400, { codigo: ['Ya existe un insumo con este código.'] })
    if (recurso === 'usuarios' && db.usuarios.some((x) => x.rut === body.rut)) throw new ApiError(400, { rut: ['Ya existe un usuario con este RUT.'] })
    tabla.push(fila)
    guardar(db)
    return out(fila)
  }

  if (method === 'PATCH' || method === 'PUT') {
    const fila = tabla.find((x) => x.id === Number(id))
    if (!fila) throw new ApiError(404, { detail: 'No encontrado.' })
    if (recurso === 'consumos' && body.estado === 'ANULADO' && !String(fila.estado).toLowerCase().startsWith('anul')) {
      const producto = db.productos.find((x) => x.id === Number(fila.producto))
      if (producto) producto.stock_actual = (Number(producto.stock_actual) + Number(fila.cantidad_retirada)).toFixed(2)
    }
    Object.assign(fila, body)
    guardar(db)
    return out(fila)
  }

  if (method === 'DELETE') {
    db[recurso] = tabla.filter((x) => x.id !== Number(id))
    guardar(db)
    return null
  }
  throw new ApiError(405, { detail: 'Método no permitido.' })
}
