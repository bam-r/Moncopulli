const esc = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s.replace(',', '.')))) s = `'${s}`
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function descargarCSV(nombre, columnas, filas) {
  const lineas = [columnas.map((c) => esc(c.titulo)).join(';'), ...filas.map((f) => columnas.map((c) => esc(c.valor(f))).join(';'))]
  const blob = new Blob([`﻿${lineas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
