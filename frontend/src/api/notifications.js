import { useCallback, useEffect, useRef, useState } from 'react'
import { listar } from './services'
import { esAnulado } from '../lib/format'

const STORAGE_PREFIX = 'moncopulli.notifications.v1.'
const INTERVALO = 30000

function leer(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null')
    return {
      conocidos: Array.isArray(data?.conocidos) ? data.conocidos.map(String) : null,
      notificaciones: Array.isArray(data?.notificaciones) ? data.notificaciones : [],
    }
  } catch {
    return { conocidos: null, notificaciones: [] }
  }
}

function guardar(key, conocidos, notificaciones) {
  try {
    localStorage.setItem(key, JSON.stringify({ conocidos, notificaciones }))
  } catch {}
}

export function useNotificaciones(usuario) {
  const key = `${STORAGE_PREFIX}${usuario?.id ?? 'sin-usuario'}`
  const inicial = useRef(leer(key))
  const [notificaciones, setNotificaciones] = useState(inicial.current.notificaciones)
  const [error, setError] = useState('')
  const consultando = useRef(false)

  const consultar = useCallback(async () => {
    if (!usuario) return
    if (consultando.current) return
    consultando.current = true
    try {
      const [consumos, usuarios, productos] = await Promise.all([
        listar('consumos'),
        listar('usuarios'),
        listar('productos'),
      ])
      const actual = leer(key)
      const conocidos = new Set(actual.conocidos ?? [])
      const primeraCarga = actual.conocidos === null
      const administradores = new Set(usuarios
        .filter((item) => ['ADMIN', 'ADMINISTRADOR'].includes(String(item.rol ?? '').toUpperCase()))
        .map((item) => String(item.id)))
      const nuevos = consumos.filter((consumo) =>
        !conocidos.has(String(consumo.id)) && !administradores.has(String(consumo.usuario)) && !esAnulado(consumo),
      )
      const nombresUsuarios = new Map(usuarios.map((item) => [String(item.id), item.nombre_completo]))
      const nombresProductos = new Map(productos.map((item) => [String(item.id), item]))
      const agregados = primeraCarga ? [] : nuevos.map((consumo) => {
        const producto = nombresProductos.get(String(consumo.producto))
        return {
          id: String(consumo.id),
          nombre: nombresUsuarios.get(String(consumo.usuario)) ?? 'Un trabajador',
          producto: producto?.nombre ?? 'un insumo',
          cantidad: consumo.cantidad_retirada,
          unidad: producto?.unidad_medida ?? '',
          fecha: consumo.fecha,
          leida: false,
        }
      })
      const ids = [...new Set([...conocidos, ...consumos.map((item) => String(item.id))])].slice(-1000)
      const lista = [...agregados, ...actual.notificaciones].slice(0, 100)
      guardar(key, ids, lista)
      setNotificaciones(lista)
      setError('')
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las notificaciones.')
    } finally {
      consultando.current = false
    }
  }, [key, usuario?.id])

  useEffect(() => {
    consultar()
    const timer = window.setInterval(consultar, INTERVALO)
    const alVolver = () => { if (document.visibilityState === 'visible') consultar() }
    window.addEventListener('focus', consultar)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', consultar)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [consultar])

  const marcarLeidas = useCallback(() => {
    setNotificaciones((lista) => {
      const actualizadas = lista.map((item) => ({ ...item, leida: true }))
      const conocidos = leer(key).conocidos ?? []
      guardar(key, conocidos, actualizadas)
      return actualizadas
    })
  }, [key])

  const noLeidas = notificaciones.filter((item) => !item.leida).length
  return { notificaciones, noLeidas, error, actualizar: consultar, marcarLeidas }
}
