import {
  ChartNoAxesColumn, CircleHelp, ClipboardList, Droplets, FileText, History, LayoutGrid, Package, PackageMinus,
  Settings, ShoppingCart, Truck, Users, Warehouse,
} from 'lucide-react'

// Todo el menú vive aquí: el menú lateral (computador) y la barra inferior (celular) salen de esta lista.
// admin: true  -> solo lo ve el administrador.
export const SECCIONES = [
  {
    titulo: 'Operaciones',
    items: [
      { to: '/consumo', label: 'Registrar consumo', corto: 'Consumo', icon: PackageMinus, destacado: true },
      { to: '/compra', label: 'Registrar compra', corto: 'Compra', icon: ShoppingCart, admin: true },
      { to: '/leche', label: 'Producción de leche', corto: 'Leche', icon: Droplets, admin: true },
    ],
  },
  {
    titulo: 'Consultar',
    items: [
      { to: '/resumen', label: 'Resumen', corto: 'Resumen', icon: LayoutGrid, admin: true },
      { to: '/stock', label: 'Stock', corto: 'Stock', icon: Package },
      { to: '/bodegas', label: 'Bodegas', corto: 'Bodegas', icon: Warehouse, admin: true },
      { to: '/historial', label: 'Historial', labelTrabajador: 'Mis retiros', corto: 'Historial', cortoTrabajador: 'Mis retiros', icon: History },
    ],
  },
  {
    titulo: 'Control',
    admin: true,
    items: [
      { to: '/inventario', label: 'Inventario', corto: 'Inventario', icon: ClipboardList, admin: true },
      { to: '/reportes', label: 'Reportes', corto: 'Reportes', icon: ChartNoAxesColumn, admin: true },
    ],
  },
  {
    titulo: 'Administración',
    admin: true,
    items: [
      { to: '/proveedores', label: 'Proveedores', corto: 'Proveedores', icon: Truck, admin: true },
      { to: '/usuarios', label: 'Usuarios', corto: 'Usuarios', icon: Users, admin: true },
    ],
  },
]

export const PIE = [
  { to: '/ayuda', label: 'Ayuda', corto: 'Ayuda', icon: CircleHelp },
  { to: '/configuracion', label: 'Configuración', corto: 'Ajustes', icon: Settings },
  { to: '/mi-informacion', label: 'Mi información', corto: 'Mi info', icon: FileText, trabajador: true },
]

// Lo que va siempre a la vista en la barra inferior del celular (el resto queda en "Más").
export const BARRA_ADMIN = ['/resumen', '/consumo', '/compra', '/stock']
export const BARRA_TRABAJADOR = ['/consumo', '/stock', '/historial']

const etiqueta = (n, admin) => (admin ? n.label : n.labelTrabajador ?? n.label)
const corto = (n, admin) => (admin ? n.corto : n.cortoTrabajador ?? n.corto)

export function menuPara(admin) {
  return SECCIONES
    .filter((s) => admin || !s.admin)
    .map((s) => ({
      titulo: s.titulo,
      items: s.items.filter((n) => admin || !n.admin).map((n) => ({ ...n, label: etiqueta(n, admin), corto: corto(n, admin) })),
    }))
    .filter((s) => s.items.length)
}

export function piePara(admin) {
  return PIE
    .filter((n) => !n.trabajador || !admin)
    .map((n) => ({ ...n, label: etiqueta(n, admin), corto: corto(n, admin) }))
}

export function titulos(admin) {
  const todos = [...menuPara(admin).flatMap((s) => s.items), ...PIE.map((n) => ({ ...n, label: etiqueta(n, admin) }))]
  return Object.fromEntries(todos.map((n) => [n.to, n.label]))
}

export const inicioPara = (admin) => (admin ? '/resumen' : '/consumo')
