import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, CircleMinus, Package, PackageMinus, Plus, Search, ShoppingCart, TriangleAlert } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos, usePendientes } from '../api/hooks'
import { Badge, Estado, LinkButton, PageHeader, Select, StatCard } from '../components/ui'
import { InsumoModal } from '../components/modals'
import { ESTADO_STOCK, estadoStock, resumenStock } from '../lib/stock'
import { esAdmin, num } from '../lib/format'
import { diasDeStock, sinTildes, stockEn } from '../lib/analisis'

export default function Stock() {
  const { usuario } = useAuth()
  const admin = esAdmin(usuario)
  const { data, loading, error, reload } = useRecursos(admin ? ['productos', 'bodegas', 'consumos'] : ['productos', 'bodegas'])
  const pendientes = usePendientes()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [est, setEst] = useState('')
  const [orden, setOrden] = useState(null)
  const [vista, setVista] = useState('total') // total | bodegas
  const [modal, setModal] = useState(null)

  const productos = useMemo(() => {
    const base = data.productos ?? []
    if (!pendientes.length) return base
    return base.map((p) => {
      const usado = pendientes.filter((c) => c.producto === p.id).reduce((s, c) => s + Number(c.cantidad_retirada), 0)
      return usado ? { ...p, stock_actual: Math.max(0, Number(p.stock_actual) - usado).toFixed(2) } : p
    })
  }, [data.productos, pendientes])

  const bodegas = (data.bodegas ?? []).filter((b) => b.estado !== false)
  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))].sort(), [productos])
  const dias = useMemo(() => (admin && data.consumos ? new Map(productos.map((p) => [p.id, diasDeStock(p, data.consumos)])) : new Map()), [admin, productos, data.consumos])
  const filas = useMemo(() => {
    const t = sinTildes(q).trim()
    let r = productos.filter((p) =>
      (!t || sinTildes(`${p.nombre} ${p.codigo}`).includes(t)) &&
      (!cat || p.categoria === cat) && (!est || estadoStock(p) === est))
    if (orden) r = [...r].sort((a, b) => (orden === 'asc' ? 1 : -1) * (Number(a.stock_actual) - Number(b.stock_actual)))
    return r
  }, [productos, q, cat, est, orden])

  const r = resumenStock(productos)
  const acciones = admin ? (
    <>
      <Link className="btn btn--secondary" to="/consumo"><PackageMinus size={20} /> Registrar consumo</Link>
      <Link className="btn btn--primary" to="/compra"><ShoppingCart size={20} /> Registrar compra</Link>
    </>
  ) : (
    <Link className="btn btn--primary btn--xl btn--block" to="/consumo"><PackageMinus size={26} /> Registrar consumo</Link>
  )

  const cabecera = (
    <PageHeader title="Stock de insumos" actions={acciones}
      subtitle={admin ? 'Consulta tus existencias, en total o bodega por bodega.' : 'Revisa existencias y registra los retiros que realices.'} />
  )
  if (loading && !data.productos) return <>{cabecera}<Estado cargando /></>
  if (error && !data.productos) return <>{cabecera}<Estado error={error} /></>

  const porBodega = vista === 'bodegas'
  const columnas = 4 + (admin ? 2 : 0) + (porBodega ? bodegas.length - 1 : 0) + (admin && !porBodega ? 1 : 0)

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
        <div className="card__head">
          <h2>Inventario</h2>
          {admin && <LinkButton icon={Plus} onClick={() => setModal('insumo')}>Añadir insumo</LinkButton>}
        </div>
        <div className="toolbar toolbar--stock">
          <span className="search">
            <Search size={20} strokeWidth={1.9} aria-hidden="true" />
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
          <div className="segmented" role="group" aria-label="Ver stock">
            <button type="button" aria-pressed={!porBodega} className={!porBodega ? 'on' : ''} onClick={() => setVista('total')}>Total</button>
            <button type="button" aria-pressed={porBodega} className={porBodega ? 'on' : ''} onClick={() => setVista('bodegas')}>Por bodega</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className={`table table--stock ${porBodega ? 'table--wide' : ''}`}>
            <thead>
              <tr>
                <th>Insumo</th><th>Categoría</th>
                <th aria-sort={orden === 'asc' ? 'ascending' : orden === 'desc' ? 'descending' : 'none'}>
                  <button type="button" className="th-sort" onClick={() => setOrden(orden === 'desc' ? 'asc' : 'desc')}>
                    {porBodega ? 'Total' : admin ? 'Cantidad' : 'Cantidad Actual'} <ArrowUpDown size={14} strokeWidth={1.75} />
                  </button>
                </th>
                {porBodega ? bodegas.map((b) => <th key={b.id} className="right">{b.nombre}</th>) : <th>Unidad</th>}
                {admin && <><th>Mínimo</th>{!porBodega && <th>Alcanza para</th>}<th>Estado</th></>}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && <tr><td colSpan={columnas} className="empty">No hay insumos que coincidan.</td></tr>}
              {filas.map((p) => {
                const e = ESTADO_STOCK[estadoStock(p)]
                const d = dias.get(p.id)
                return (
                  <tr key={p.id}>
                    <td><div className="name">{p.nombre}</div><div className="sub">{p.codigo}</div></td>
                    <td>{p.categoria}</td>
                    <td className="num">{num(p.stock_actual)}{porBodega ? ` ${p.unidad_medida}` : ''}</td>
                    {porBodega
                      ? bodegas.map((b) => { const v = stockEn(p, b.id); return <td key={b.id} className={`right ${v ? 'num' : 'muted-cell'}`}>{v ? num(v) : '—'}</td> })
                      : <td className="unit">{p.unidad_medida}</td>}
                    {admin && (
                      <>
                        <td>{num(p.stock_minimo)} {p.unidad_medida}</td>
                        {!porBodega && <td>{Number(p.stock_actual) <= 0 ? <b>Agotado</b> : d == null ? <span className="muted-cell">Sin consumo</span> : d < 1 ? 'Menos de 1 día' : `${Math.floor(d)} ${Math.floor(d) === 1 ? 'día' : 'días'}`}</td>}
                        <td><Badge tone={e.tone}>{e.label}</Badge></td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'insumo' && <InsumoModal productos={productos} bodegas={data.bodegas} onClose={() => setModal(null)} onSaved={reload} />}
    </div>
  )
}
