import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Resumen from './pages/Resumen'
import Stock from './pages/Stock'
import Usuarios from './pages/Usuarios'
import Inventario from './pages/Inventario'
import Reportes from './pages/Reportes'
import Proveedores from './pages/Proveedores'
import Configuracion from './pages/Configuracion'
import Ayuda from './pages/Ayuda'
import { esAdmin } from './lib/format'

function Protegida({ soloAdmin, children }) {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  if (soloAdmin && !esAdmin(usuario)) return <Navigate to="/stock" replace />
  return children
}

export default function App() {
  const { usuario } = useAuth()
  const inicio = usuario ? (esAdmin(usuario) ? '/resumen' : '/stock') : '/login'
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegida><AppLayout /></Protegida>}>
        <Route path="/stock" element={<Stock />} />
        <Route path="/resumen" element={<Protegida soloAdmin><Resumen /></Protegida>} />
        <Route path="/usuarios" element={<Protegida soloAdmin><Usuarios /></Protegida>} />
        <Route path="/inventario" element={<Protegida soloAdmin><Inventario /></Protegida>} />
        <Route path="/reportes" element={<Protegida soloAdmin><Reportes /></Protegida>} />
        <Route path="/proveedores" element={<Protegida soloAdmin><Proveedores /></Protegida>} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/ayuda" element={<Ayuda />} />
      </Route>
      <Route path="*" element={<Navigate to={inicio} replace />} />
    </Routes>
  )
}
