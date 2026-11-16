import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ClipboardList, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { Badge, Estado, PageHeader, Select } from '../components/ui'
import { AnularConsumoModal } from '../components/modals-extra'
import { esAdmin, esAnulado, hm, dmy, num, parseDate, pesos } from '../lib/format'
import { documentosConTotal, enRango, rangoUltimos, sinTildes } from '../lib/analisis'

const RECURSOS = ['consumos', 'productos', 'usuarios', 'bodegas', 'proveedores', 'documentos-compra', 'detalle-documentos', 'inventarios', 'detalle-inventarios']
const PERIODOS = { 7: 'Última semana', 30: 'Último mes', 90: 'Últimos 3 meses', todo: 'Todo' }
const TIPOS = { todos: 'Todo', salida: 'Retiros', entrada: 'Compras', inventario: 'Inventarios' }
const POR_PAGINA = 40

export default function Historial() {
  const { usuario } = useAuth()
  const admin = esAdmin(usuario)
  const { data, loading, error, reload } = useRecursos(RECURSOS)
  const [periodo, setPeriodo] = useState('30')
  const [tipo, setTipo] = useState('todos')
  const [persona, setPersona] = useState('')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [anular, setAnular] = useState(null)

  const movs = useMemo(() => {
    if (!data.consumos) return []
    const prod = new Map(data.productos.map((p) => [p.id, p]))
    const usu = new Map(data.usuarios.map((u) => [u.id, u]))
    const bod = new Map(data.bodegas.map((b) => [b.id, b]))
    const prov = new Map(data.proveedores.map((p) => [p.id, p]))
    const salidas = data.consumos.map((c) => {
      const p = prod.get(c.producto)
      return {
        key: `c${c.id}`, tipo: 'salida', fecha: parseDate(c.fecha), conHora: true, usuarioId: c.usuario,
        persona: usu.get(c.usuario)?.nombre_completo ?? 'Usuario', titulo: p?.nombre ?? 'Insumo',
        detalle: `${bod.get(c.bodega)?.nombre ?? 'Bodega'}`, cantidad: `${num(c.cantidad_retirada)} ${p?.unidad_medida ?? ''}`,
        anulado: esAnulado(c), motivo: c.motivo_anulacion, consumo: c,
        texto: `${p?.nombre} ${p?.codigo}`,
      }
    })
    if (!admin) return salidas.filter((m) => m.usuarioId === usuario.id).sort((a, b) => b.fecha - a.fecha)
    const compras = documentosConTotal(data['documentos-compra'], data['detalle-documentos']).map((d) => ({
      key: `d${d.id}`, tipo: 'entrada', fecha: d.fecha, conHora: false, usuarioId: d.usuario,
      persona: usu.get(d.usuario)?.nombre_completo ?? 'Usuario',
      titulo: `${d.tipo_documento} N° ${d.numero_folio} · ${prov.get(d.proveedor)?.nombre ?? 'Proveedor'}`,
      detalle: `${bod.get(d.bodega)?.nombre ?? 'Bodega'} · ${d.lineas.map((l) => prod.get(l.producto)?.nombre).filter(Boolean).slice(0, 3).join(', ')}${d.lineas.length > 3 ? '…' : ''}`,
      cantidad: pesos(d.total), anulado: false,
      texto: `${prov.get(d.proveedor)?.nombre} ${d.numero_folio} ${d.lineas.map((l) => prod.get(l.producto)?.nombre).join(' ')}`,
    }))
    const inventarios = data.inventarios.map((i) => {
      const det = data['detalle-inventarios'].filter((d) => d.inventario === i.id)
      const sis = det.reduce((s, d) => s + Number(d.stock_sistema), 0)
      const real = det.reduce((s, d) => s + Number(d.stock_real), 0)
      return {
        key: `i${i.id}`, tipo: 'inventario', fecha: parseDate(i.fecha), conHora: false, usuarioId: i.usuario,
        persona: usu.get(i.usuario)?.nombre_completo ?? 'Usuario', titulo: `Inventario · ${bod.get(i.bodega)?.nombre ?? 'Bodega'}`,
        detalle: `${det.length} insumos contados`, cantidad: sis ? `${(((real - sis) / sis) * 100).toFixed(1).replace('.', ',')} %` : '—',
        anulado: esAnulado(i), motivo: i.motivo_anulacion, texto: bod.get(i.bodega)?.nombre ?? '',
      }
    })
    return [...salidas, ...compras, ...inventarios].sort((a, b) => b.fecha - a.fecha)
  }, [data, admin, usuario.id])

  const filtrados = useMemo(() => {
    const r = periodo === 'todo' ? null : rangoUltimos(Number(periodo))
    const t = sinTildes(q).trim()
    return movs.filter((m) =>
      (!r || enRango(m.fecha, r)) && (tipo === 'todos' || m.tipo === tipo) && (!persona || String(m.usuarioId) === persona) &&
      (!t || sinTildes(`${m.texto} ${m.persona}`).includes(t)))
  }, [movs, periodo, tipo, persona, q])

  const cabecera = (
    <PageHeader title={admin ? 'Historial' : 'Mis retiros'}
      subtitle={admin ? 'Todos los retiros, compras e inventarios, con quién los hizo y cuándo.' : 'Los retiros que has registrado.'} />
  )
  if (loading && !data.consumos) return <>{cabecera}<Estado cargando /></>
  if (error && !data.consumos) return <>{cabecera}<Estado error={error} /></>

  const visibles = filtrados.slice(0, pagina * POR_PAGINA)
  const reset = (f) => (e) => { f(e.target.value); setPagina(1) }

  return (
    <>
      {cabecera}
      <section className="card">
        <div className="filtros">
          <span className="search">
            <Search size={20} strokeWidth={1.9} aria-hidden="true" />
            <input className="input" type="search" aria-label="Buscar" placeholder={admin ? 'Buscar insumo, proveedor o persona' : 'Buscar insumo'} value={q} onChange={reset(setQ)} />
          </span>
          <Select aria-label="Período" value={periodo} onChange={reset(setPeriodo)}>{Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          {admin && (
            <>
              <Select aria-label="Tipo de movimiento" value={tipo} onChange={reset(setTipo)}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              <Select aria-label="Persona" value={persona} onChange={reset(setPersona)}>
                <option value="">Todas las personas</option>
                {data.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
              </Select>
            </>
          )}
        </div>
        <p className="filtros__count" aria-live="polite">{filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}</p>

        {filtrados.length === 0 ? (
          <div className="state">No hay registros con estos filtros.</div>
        ) : (
          <ul className="movs">
            {visibles.map((m) => (
              <li key={m.key} className={`mov ${m.anulado ? 'mov--anulado' : ''}`}>
                <span className={`mov__icon mov__icon--${m.tipo}`} aria-hidden="true">
                  {m.tipo === 'salida' ? <ArrowUpRight size={22} /> : m.tipo === 'entrada' ? <ArrowDownLeft size={22} /> : <ClipboardList size={22} />}
                </span>
                <div className="mov__main">
                  <b>{m.titulo}</b>
                  <span>{m.detalle}</span>
                  {admin && <span>Registró: <b>{m.persona}</b></span>}
                  {m.anulado && <span className="mov__motivo">Anulado{m.motivo ? `: ${m.motivo}` : ''}</span>}
                </div>
                <div className="mov__side">
                  <b>{m.tipo === 'entrada' ? '+ ' : ''}{m.cantidad}</b>
                  <span>{dmy(m.fecha)}{m.conHora ? ` · ${hm(m.fecha)}` : ''}</span>
                  {m.anulado ? <Badge tone="danger">Anulado</Badge>
                    : admin && m.tipo === 'salida' && <button type="button" className="link-btn link-btn--danger" onClick={() => setAnular(m)}>Anular</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {visibles.length < filtrados.length && (
          <div className="movs__more"><button type="button" className="btn btn--secondary btn--lg" onClick={() => setPagina(pagina + 1)}>Mostrar más ({filtrados.length - visibles.length} restantes)</button></div>
        )}
      </section>
      {anular && <AnularConsumoModal consumo={anular.consumo} descripcion={`${anular.persona} retiró ${anular.cantidad} de ${anular.titulo}`} usuario={usuario} onClose={() => setAnular(null)} onSaved={reload} />}
    </>
  )
}
