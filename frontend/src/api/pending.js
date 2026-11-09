const KEY = 'moncopulli.pending.v1'
export const EVENTO_PENDIENTES = 'moncopulli:pending'
export const EVENTO_DATOS = 'moncopulli:changed'

export function leerPendientes() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function escribir(lista) {
  try { localStorage.setItem(KEY, JSON.stringify(lista)) } catch {}
  window.dispatchEvent(new Event(EVENTO_PENDIENTES))
}
export function agregarPendiente(consumo) {
  escribir([...leerPendientes(), { ...consumo, _local: crypto.randomUUID?.() ?? String(Date.now()) }])
}
export function quitarPendiente(local) {
  escribir(leerPendientes().filter((c) => c._local !== local))
}
