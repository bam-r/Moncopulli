const pad = (n) => String(n).padStart(2, '0')
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const num = (v) => Number(v ?? 0).toFixed(2).replace('.', ',')
export const dmy = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function parseDate(s) {
  if (s instanceof Date) return s
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(s)
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const diasDesdeHoy = (d) => Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000)

export function cuando(d, conHora = true) {
  const dias = diasDesdeHoy(d)
  const h = conHora ? `, ${hm(d)}` : ''
  if (dias === 0) return `Hoy${h}`
  if (dias === 1) return `Ayer${h}`
  return dmy(d)
}

export function ultimoRetiro(d) {
  if (diasDesdeHoy(d) === 0) {
    const h = d.getHours()
    return `Hoy a las ${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
  }
  return `${pad(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export const iniciales = (nombre = '') =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')

export const esAdmin = (u) => ['ADMIN', 'ADMINISTRADOR'].includes(String(u?.rol ?? '').toUpperCase())
export const esActivo = (u) => String(u?.estado ?? '').toLowerCase().startsWith('activ')
export const esAnulado = (r) => String(r?.estado ?? '').toLowerCase().startsWith('anul')

export const miles = (v) => Math.round(Number(v ?? 0)).toLocaleString('es-CL')
export const pesos = (v) => `$${miles(v)}`
