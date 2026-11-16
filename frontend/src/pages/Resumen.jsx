import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ClipboardList, Droplets, PackageMinus, ShoppingCart, TriangleAlert, Trophy, UserRound, Wallet } from 'lucide-react'
import { useRecursos } from '../api/hooks'
import { Estado, PageHeader, StatCard } from '../components/ui'
import { BarList, ColumnChart, GraficoCard } from '../components/charts'
import { construirMovimientos, ultimoInventario } from '../lib/movimientos'
import { ESTADO_STOCK, estadoStock } from '../lib/stock'
import { cuando, dmy, num, parseDate, pesos, miles } from '../lib/format'
import {
  agrupar, documentosConTotal, enRango, fechaConsumo, inicioDia, rangoAnterior, rangoUltimos, retirosPorTrabajador,
  serieDiaria, valorStock, variacion, vigentes, sumarDias,
} from '../lib/analisis'

const RECURSOS = ['productos', 'consumos', 'documentos-compra', 'detalle-documentos', 'usuarios', 'proveedores', 'bodegas', 'inventarios', 'detalle-inventarios', 'produccion-leche']

const delta = (v, sufijo = 'vs. semana anterior') => (v == null ? 'Sin datos de la semana anterior' : Math.round(v) === 0 ? 'Igual que la semana anterior' : `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(0)} % ${sufijo}`)

export default function Resumen() {
  const { data, loading, error } = useRecursos(RECURSOS)

  const r = useMemo(() => {
    if (!data.productos) return null
    const sem = rangoUltimos(7), ant = rangoAnterior(sem)
    const hoy = inicioDia(new Date())
    const prod = new Map(data.productos.map((p) => [p.id, p]))
    const consumos = vigentes(data.consumos)
    const retSem = consumos.filter((c) => enRango(fechaConsumo(c), sem))
    const retAnt = consumos.filter((c) => enRango(fechaConsumo(c), ant))
    const retHoy = consumos.filter((c) => fechaConsumo(c) >= hoy).length

    const docs = documentosConTotal(data['documentos-compra'], data['detalle-documentos'])
    const comSem = docs.filter((d) => enRango(d.fecha, sem))
    const comAnt = docs.filter((d) => enRango(d.fecha, ant))

    const trabajadores = retirosPorTrabajador(data.consumos, data.usuarios, data.productos, sem)
    const porProducto = [...agrupar(retSem, (c) => c.producto).entries()]
      .map(([id, l]) => ({ p: prod.get(id), retiros: l.length, cantidad: l.reduce((s, c) => s + Number(c.cantidad_retirada), 0) }))
      .sort((a, b) => b.retiros - a.retiros || b.cantidad - a.cantidad)

    const urgentes = data.productos.filter((p) => estadoStock(p) !== 'ok')
      .sort((a, b) => (Number(a.stock_actual) / Number(a.stock_minimo || 1)) - (Number(b.stock_actual) / Number(b.stock_minimo || 1)))

    const leche = data['produccion-leche'].filter((l) => enRango(parseDate(l.fecha), sem)).reduce((s, l) => s + Number(l.litros), 0)
    const lecheAnt = data['produccion-leche'].filter((l) => enRango(parseDate(l.fecha), ant)).reduce((s, l) => s + Number(l.litros), 0)

    return {
      sem, retSem, retHoy, varRet: variacion(retSem.length, retAnt.length),
      comSem, totalCompras: comSem.reduce((s, d) => s + d.total, 0), varCom: variacion(comSem.length, comAnt.length),
      trabajadores, porProducto, urgentes, leche, varLeche: variacion(leche, lecheAnt),
      porDia: serieDiaria(retSem, { fecha: fechaConsumo, valor: () => 1 }, sem),
      valorInventario: data.productos.reduce((s, p) => s + valorStock(p), 0),
      inv: ultimoInventario(data.inventarios, data['detalle-inventarios']),
      movs: construirMovimientos({ consumos: data.consumos, documentos: data['documentos-compra'], detalles: data['detalle-documentos'], productos: data.productos, usuarios: data.usuarios, proveedores: data.proveedores }).slice(0, 8),
    }
  }, [data])

  const acciones = (
    <>
      <Link className="btn btn--secondary" to="/consumo"><PackageMinus size={20} /> Registrar consumo</Link>
      <Link className="btn btn--primary" to="/compra"><ShoppingCart size={20} /> Registrar compra</Link>
    </>
  )
  const cabecera = <PageHeader title="Resumen" subtitle={r ? `Últimos 7 días: del ${dmy(r.sem.ini)} al ${dmy(sumarDias(r.sem.fin, -1))}.` : 'Revisa todo lo que ha pasado recientemente.'} actions={acciones} />
  if (loading && !r) return <>{cabecera}<Estado cargando /></>
  if (error && !r) return <>{cabecera}<Estado error={error} /></>

  const top = r.trabajadores[0]
  const topProd = r.porProducto[0]

  return (
    <>
      {cabecera}

      <div className="stats stats--4">
        <StatCard icon={ShoppingCart} label="Compras de la semana" value={r.comSem.length} note={r.comSem.length ? `${pesos(r.totalCompras)} · ${delta(r.varCom)}` : 'Sin compras esta semana'} />
        <StatCard icon={ArrowUpRight} tone="warning" label="Retiros de la semana" value={r.retSem.length} note={`${r.retHoy} hoy · ${delta(r.varRet)}`} />
        <StatCard icon={UserRound} tone="neutral" label="Quién más retiró" value={top?.nombre ?? '—'} note={top ? `${top.retiros} ${top.retiros === 1 ? 'retiro' : 'retiros'} esta semana` : 'Sin retiros esta semana'} />
        <StatCard icon={Trophy} tone="neutral" label="Insumo más retirado" value={topProd?.p?.nombre ?? '—'} note={topProd ? `${topProd.retiros} retiros · ${num(topProd.cantidad)} ${topProd.p?.unidad_medida ?? ''}` : 'Sin retiros esta semana'} />
      </div>

      <div className="grid-2">
        <GraficoCard titulo="Retiros por día" nota="Cantidad de retiros registrados cada día."
          vacio={r.retSem.length === 0 && 'No hay retiros esta semana.'}
          tabla={{ columnas: ['Día', 'Retiros'], filas: [...r.porDia].reverse().map((d) => [dmy(d.fecha), d.valor]) }}>
          <ColumnChart datos={r.porDia} unidad="retiros" />
        </GraficoCard>

        <section className="card chart-card">
          <header className="chart-card__head">
            <div><h2>Stock bajo</h2><p className="sub">{r.urgentes.length ? 'Insumos que hay que reponer.' : 'Todo sobre el mínimo.'}</p></div>
            <Link className="link-btn" to="/stock">Ver stock</Link>
          </header>
          {r.urgentes.length === 0 ? <div className="chart-empty">No hay insumos bajo el mínimo.</div> : (
            <ul className="alertas">
              {r.urgentes.slice(0, 6).map((p) => {
                const e = ESTADO_STOCK[estadoStock(p)]
                const pct = Math.min(100, (Number(p.stock_actual) / Number(p.stock_minimo || 1)) * 100)
                return (
                  <li key={p.id} className={`alerta alerta--${estadoStock(p)}`}>
                    <div className="alerta__top"><b>{p.nombre}</b><span className={`badge badge--${e.tone}`}>{e.label}</span></div>
                    <div className="alerta__bar" aria-hidden="true"><span style={{ width: `${Math.max(pct, 3)}%` }} /></div>
                    <span className="sub">Hay {num(p.stock_actual)} {p.unidad_medida} · mínimo {num(p.stock_minimo)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="stats stats--3 stats--spaced">
        <StatCard icon={Wallet} tone="neutral" label="Valor del inventario" value={pesos(r.valorInventario)} note="Stock actual × costo promedio" />
        <StatCard icon={Droplets} tone="neutral" label="Leche de la semana" value={`${miles(r.leche)} L`} note={r.leche ? delta(r.varLeche) : 'Sin registros'} />
        <StatCard icon={ClipboardList} tone="neutral" label="Último inventario" value={r.inv ? `${r.inv.desviacion.toFixed(1).replace('.', ',')} %` : '—'} note={r.inv ? `Desviación · ${dmy(r.inv.fecha)}` : 'Aún no hay inventarios'} />
      </div>

      <div className="grid-2">
        <GraficoCard titulo="Retiros por persona" nota="Esta semana."
          accion={<Link className="link-btn" to="/reportes">Ver reportes</Link>}
          vacio={r.trabajadores.length === 0 && 'No hay retiros esta semana.'}
          tabla={{ columnas: ['Persona', 'Retiros'], filas: r.trabajadores.map((t) => [t.nombre, t.retiros]) }}>
          <BarList items={r.trabajadores.slice(0, 6).map((t) => ({ key: t.id, label: t.nombre, texto: `${t.retiros}`, valor: t.retiros, detalle: `Más retirado: ${t.masRetirado}` }))} />
        </GraficoCard>

        <section className="card table-card">
          <div className="card__head"><h2>Movimientos recientes</h2><Link className="link-btn" to="/historial">Ver historial</Link></div>
          <ul className="movs movs--compact">
            {r.movs.length === 0 && <li className="state">Todavía no hay movimientos.</li>}
            {r.movs.map((m) => (
              <li key={m.key} className="mov">
                <span className={`mov__icon mov__icon--${m.tipo}`} aria-hidden="true">{m.tipo === 'entrada' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}</span>
                <div className="mov__main">
                  <b>{m.producto}</b>
                  <span>{m.tipo === 'entrada' ? <>Compra a {m.proveedor}</> : <>Retiró {m.usuario}</>}</span>
                </div>
                <div className="mov__side"><b>{m.tipo === 'entrada' ? '+ ' : ''}{num(m.cantidad)} {m.unidad}</b><span>{cuando(m.fecha, m.conHora)}</span></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
