import { useCallback, useEffect, useRef, useState } from 'react'
import { listar } from './services'
import { EVENTO_DATOS, EVENTO_PENDIENTES, leerPendientes } from './pending'

export function useRecursos(nombres) {
  const [estado, setEstado] = useState({ data: {}, loading: true, error: null })
  const clave = nombres.join(',')
  const vivo = useRef(true)

  const cargar = useCallback(() => {
    setEstado((s) => ({ ...s, loading: true, error: null }))
    return Promise.all(nombres.map((n) => listar(n)))
      .then((res) => vivo.current && setEstado({ data: Object.fromEntries(nombres.map((n, i) => [n, res[i]])), loading: false, error: null }))
      .catch((e) => vivo.current && setEstado((s) => ({ ...s, loading: false, error: e.message || 'No se pudo cargar' })))
  }, [clave])

  useEffect(() => {
    vivo.current = true
    cargar()
    window.addEventListener(EVENTO_DATOS, cargar)
    return () => { vivo.current = false; window.removeEventListener(EVENTO_DATOS, cargar) }
  }, [cargar])

  return { ...estado, reload: cargar }
}

export function usePendientes() {
  const [lista, setLista] = useState(leerPendientes)
  useEffect(() => {
    const f = () => setLista(leerPendientes())
    window.addEventListener(EVENTO_PENDIENTES, f)
    return () => window.removeEventListener(EVENTO_PENDIENTES, f)
  }, [])
  return lista
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}
