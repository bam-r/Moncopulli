export const cleanRut = (v = '') => v.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9)

export function digitoVerificador(cuerpo) {
  let suma = 0
  let mult = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const r = 11 - (suma % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}

export function formatRut(v = '') {
  const c = cleanRut(v)
  if (c.length < 2) return c
  const cuerpo = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${c.slice(-1)}`
}

export function isValidRut(v = '') {
  const c = cleanRut(v)
  if (c.length < 8) return false
  return digitoVerificador(c.slice(0, -1)) === c.slice(-1)
}

export const rutConDv = (cuerpo) => formatRut(cuerpo + digitoVerificador(cuerpo))
