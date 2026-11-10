export function estadoStock(p) {
  const actual = Number(p.stock_actual)
  if (actual <= 0) return 'sin'
  if (actual < Number(p.stock_minimo)) return 'bajo'
  return 'ok'
}

export const ESTADO_STOCK = {
  ok: { label: 'Disponible', tone: 'success' },
  bajo: { label: 'Stock bajo', tone: 'warning' },
  sin: { label: 'Sin stock', tone: 'danger' },
}

export function resumenStock(productos) {
  const r = { total: productos.length, ok: 0, bajo: 0, sin: 0 }
  productos.forEach((p) => { r[estadoStock(p)] += 1 })
  return r
}
