import { useCallback, useEffect, useRef, useState } from 'react'
import { leerCache, listar } from './services'
import { EVENTO_DATOS, EVENTO_PENDIENTES, leerPendientes } from './pending'

export function useRecursos(nombres) {
  const [estado, setEstado] = useState(() => {
    const data = {}
    let completo = true
    for (const n of nombres) {
      const enCache = leerCache(n)
      if (enCache !== undefined) data[n] = enCache
      else completo = false
    }
    return { data, loading: !completo, error: null }
  })
  const clave = nombres.join(',')
  const vivo = useRef(true)

  const cargar = useCallback(() => {
    setEstado((s) => {
      const tieneDatos = nombres.every((n) => s.data[n] !== undefined)
      return { ...s, loading: !tieneDatos, error: null }
    })
    return Promise.all(nombres.map((n) => listar(n)))
      .then((res) => vivo.current && setEstado({ data: Object.fromEntries(nombres.map((n, i) => [n, res[i]])), loading: false, error: null }))
      .catch((e) => vivo.current && setEstado((s) => ({ ...s, loading: false, error: e.message || 'No se pudo cargar' })))
  }, [clave])

  useEffect(() => {
    vivo.current = true
    cargar()
    window.addEventListener(EVENTO_DATOS, cargar)
    window.addEventListener('online', cargar)
    return () => {
      vivo.current = false
      window.removeEventListener(EVENTO_DATOS, cargar)
      window.removeEventListener('online', cargar)
    }
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

// Reloj en vivo (se actualiza cada segundo). Sirve para mostrar la fecha y hora del registro.
export function useAhora(ms = 1000) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return ahora
}
