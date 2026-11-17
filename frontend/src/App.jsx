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
import RegistrarConsumo from './pages/RegistrarConsumo'
import RegistrarCompra from './pages/RegistrarCompra'
import Historial from './pages/Historial'
import Bodegas from './pages/Bodegas'
import Leche from './pages/Leche'
import MiInformacion from './pages/MiInformacion'
import { inicioPara } from './components/nav'
import { esAdmin } from './lib/format'

function Protegida({ soloAdmin, children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return null
  if (!usuario) return <Navigate to="/login" replace />
  if (soloAdmin && !esAdmin(usuario)) return <Navigate to="/consumo" replace />
  return children
}

export default function App() {
  const { usuario } = useAuth()
  const inicio = usuario ? inicioPara(esAdmin(usuario)) : '/login'
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegida><AppLayout /></Protegida>}>
        <Route path="/consumo" element={<RegistrarConsumo />} />
        <Route path="/compra" element={<Protegida soloAdmin><RegistrarCompra /></Protegida>} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/bodegas" element={<Protegida soloAdmin><Bodegas /></Protegida>} />
        <Route path="/leche" element={<Protegida soloAdmin><Leche /></Protegida>} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/resumen" element={<Protegida soloAdmin><Resumen /></Protegida>} />
        <Route path="/usuarios" element={<Protegida soloAdmin><Usuarios /></Protegida>} />
        <Route path="/inventario" element={<Protegida soloAdmin><Inventario /></Protegida>} />
        <Route path="/reportes" element={<Protegida soloAdmin><Reportes /></Protegida>} />
        <Route path="/proveedores" element={<Protegida soloAdmin><Proveedores /></Protegida>} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/ayuda" element={<Ayuda />} />
        <Route path="/mi-informacion" element={<MiInformacion />} />
      </Route>
      <Route path="*" element={<Navigate to={inicio} replace />} />
    </Routes>
  )
}
