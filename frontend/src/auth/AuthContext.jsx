import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { iniciarSesion, listar } from '../api/services'
import { setToken } from '../api/client'
import { cleanRut } from '../lib/rut'

const KEY = 'moncopulli.sesion'
const AuthCtx = createContext(null)

function leer() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leer)

  const login = useCallback(async (rut, contrasena) => {
    const res = await iniciarSesion(rut, contrasena)
    if (res.token) setToken(res.token)
    try { localStorage.setItem(KEY, JSON.stringify(res.usuario)) } catch {}
    setUsuario(res.usuario)
    return res.usuario
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    try { localStorage.removeItem(KEY) } catch {}
    setUsuario(null)
  }, [])

  const actualizarUsuario = useCallback((cambios) => {
    setUsuario((u) => {
      const nuevo = { ...u, ...cambios }
      try { localStorage.setItem(KEY, JSON.stringify(nuevo)) } catch {}
      return nuevo
    })
  }, [])

  // Sincroniza la sesión guardada en localStorage con los usuarios reales del backend de Django
  useEffect(() => {
    if (!usuario) return
    let cancelado = false
    listar('usuarios')
      .then((usuarios) => {
        if (cancelado) return
        const real = usuarios.find((x) => cleanRut(x.rut) === cleanRut(usuario.rut ?? '') || x.id === usuario.id)
        if (!real || !String(real.estado).toLowerCase().startsWith('activ')) {
          logout()
        } else if (JSON.stringify(real) !== JSON.stringify(usuario)) {
          try { localStorage.setItem(KEY, JSON.stringify(real)) } catch {}
          setUsuario(real)
        }
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [])

  const value = useMemo(() => ({ usuario, login, logout, actualizarUsuario }), [usuario, login, logout, actualizarUsuario])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
