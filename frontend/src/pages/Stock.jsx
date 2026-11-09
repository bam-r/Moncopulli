import { useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUpRight, CircleMinus, Package, Plus, Search, TriangleAlert } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos, usePendientes } from '../api/hooks'
import { Badge, Button, Estado, LinkButton, PageHeader, Select, StatCard } from '../components/ui'
import { CompraModal, InsumoModal, SalidaModal } from '../components/modals'
import { ESTADO_STOCK, estadoStock, resumenStock } from '../lib/stock'
import { esAdmin, num } from '../lib/format'

export default function Stock() {
  const { usuario } = useAuth()
  const admin = esAdmin(usuario)
  const { data, loading, error, reload } = useRecursos(['productos', 'bodegas', 'proveedores'])
  const pendientes = usePendientes()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [est, setEst] = useState('')
  const [orden, setOrden] = useState(null)
  const [modal, setModal] = useState(null)

  const productos = useMemo(() => {
    const base = data.productos ?? []
    if (!pendientes.length) return base
    return base.map((p) => {
      const usado = pendientes.filter((c) => c.producto === p.id).reduce((s, c) => s + Number(c.cantidad_retirada), 0)
      return usado ? { ...p, stock_actual: Math.max(0, Number(p.stock_actual) - usado).toFixed(2) } : p
    })
  }, [data.productos, pendientes])

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))].sort(), [productos])
  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    let r = productos.filter((p) =>
      (!t || p.nombre.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t)) &&
      (!cat || p.categoria === cat) && (!est || estadoStock(p) === est))
    if (orden) r = [...r].sort((a, b) => (orden === 'asc' ? 1 : -1) * (Number(a.stock_actual) - Number(b.stock_actual)))
    return r
  }, [productos, q, cat, est, orden])

  const r = resumenStock(productos)
  const botonSalida = admin
    ? <Button variant="secondary" icon={ArrowUpRight} onClick={() => setModal('salida')}>Registrar salida</Button>
    : <Button block icon={ArrowUpRight} className="btn--tall" onClick={() => setModal('salida')}>Registrar salida</Button>

  const acciones = admin ? (
    <>{botonSalida}<Button icon={Plus} onClick={() => setModal('compra')}>Agregar Compra</Button></>
  ) : botonSalida

  const cabecera = (
    <PageHeader title="Stock de insumos" actions={acciones}
      subtitle={admin ? 'Consulta tus existencias y registra cada entrada o salida.' : 'Revisa existencias y registra los retiros que realices.'} />
  )
  if (loading && !data.productos) return <>{cabecera}<Estado cargando /></>
  if (error && !data.productos) return <>{cabecera}<Estado error={error} /></>

  return (
    <div className={admin ? '' : 'worker'}>
      {cabecera}

      {admin ? (
        <div className="stats stats--3">
          <StatCard icon={Package} label="Insumos registrados" value={r.total} note={`${r.ok} con stock suficiente`} />
          <StatCard icon={TriangleAlert} tone="warning" label="Stock bajo" value={r.bajo} note="Por debajo del mínimo" />
          <StatCard icon={CircleMinus} tone="danger" label="Sin stock" value={r.sin} note="Pendiente de reposición" />
        </div>
      ) : (
        <div className="stats stats--2">
          <StatCard icon={Package} label="Insumos disponibles" value={r.total} note="Total en inventario" />
          <StatCard icon={TriangleAlert} tone="warning" label="Aviso de stock" value={r.bajo + r.sin} note="Poca cantidad disponible" />
        </div>
      )}

      <section className="card table-card">
        {admin && (
          <div className="card__head">
            <h2>Inventario</h2>
            <LinkButton icon={Plus} onClick={() => setModal('insumo')}>Añadir insumo</LinkButton>
          </div>
        )}
        <div className="toolbar toolbar--stock">
          <span className="search">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            <input className="input" type="search" aria-label="Buscar insumo" placeholder={admin ? 'Buscar por nombre o código' : 'Buscar insumo...'} value={q} onChange={(e) => setQ(e.target.value)} />
          </span>
          <Select aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{admin ? 'Todas las categorías' : 'Categorías'}</option>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select aria-label="Estado" value={est} onChange={(e) => setEst(e.target.value)}>
            <option value="">{admin ? 'Todos los estados' : 'Estados'}</option>
            {Object.entries(ESTADO_STOCK).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>

        <div className="table-wrap">
          <table className="table table--stock">
            <thead>
              <tr>
                <th>Insumo</th><th>Categoría</th>
                <th aria-sort={orden === 'asc' ? 'ascending' : orden === 'desc' ? 'descending' : 'none'}>
                  <button type="button" className="th-sort" onClick={() => setOrden(orden === 'desc' ? 'asc' : 'desc')}>
                    {admin ? 'Cantidad' : 'Cantidad Actual'} <ArrowUpDown size={14} strokeWidth={1.75} />
                  </button>
                </th>
                <th>Unidad</th>
                {admin && <><th>Mínimo</th><th>Estado</th></>}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && <tr><td colSpan={admin ? 6 : 4} className="empty">No hay insumos que coincidan.</td></tr>}
              {filas.map((p) => {
                const e = ESTADO_STOCK[estadoStock(p)]
                return (
                  <tr key={p.id}>
                    <td><div className="name">{p.nombre}</div><div className="sub">{p.codigo}</div></td>
                    <td>{p.categoria}</td>
                    <td className="num">{num(p.stock_actual)}</td>
                    <td className="unit">{p.unidad_medida}</td>
                    {admin && <><td>{num(p.stock_minimo)} {p.unidad_medida}</td><td><Badge tone={e.tone}>{e.label}</Badge></td></>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'salida' && <SalidaModal productos={productos} bodegas={data.bodegas} usuario={usuario} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'compra' && <CompraModal productos={productos} proveedores={data.proveedores} bodegas={data.bodegas} usuario={usuario} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'insumo' && <InsumoModal productos={productos} onClose={() => setModal(null)} onSaved={reload} />}
    </div>
  )
}
