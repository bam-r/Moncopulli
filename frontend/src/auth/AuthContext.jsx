import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { iniciarSesion } from '../api/services'
import { setToken } from '../api/client'

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

  const value = useMemo(() => ({ usuario, login, logout, actualizarUsuario }), [usuario, login, logout, actualizarUsuario])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
