import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CircleCheck, Lock, PackageMinus, TriangleAlert, UserRound, WifiOff } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useAhora, useRecursos, usePendientes } from '../api/hooks'
import { registrarSalida } from '../api/services'
import { Estado, PageHeader } from '../components/ui'
import ProductoPicker from '../components/ProductoPicker'
import Cantidad from '../components/Cantidad'
import { useToast } from '../components/Toast'
import { esAdmin, fechaLarga, horaCompleta, num, parseDate, esAnulado } from '../lib/format'
import { stockEn } from '../lib/analisis'

const RECURSOS = ['productos', 'bodegas', 'consumos']

export default function RegistrarConsumo() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useRecursos(RECURSOS)
  const pendientes = usePendientes()
  const ahora = useAhora()
  const [prodId, setProdId] = useState(null)
  const [bodegaId, setBodegaId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [hecho, setHecho] = useState(null)

  // Lo que ya está en cola sin conexión también se descuenta de lo que se ve disponible.
  const productos = useMemo(() => {
    const base = data.productos ?? []
    if (!pendientes.length) return base
    return base.map((p) => {
      const mias = pendientes.filter((c) => c.producto === p.id)
      if (!mias.length) return p
      const total = mias.reduce((s, c) => s + Number(c.cantidad_retirada), 0)
      return {
        ...p,
        stock_actual: Math.max(0, Number(p.stock_actual) - total).toFixed(2),
        stock_por_bodega: (p.stock_por_bodega ?? []).map((s) => {
          const usado = mias.filter((c) => c.bodega === s.bodega).reduce((a, c) => a + Number(c.cantidad_retirada), 0)
          return usado ? { ...s, cantidad: Math.max(0, Number(s.cantidad) - usado).toFixed(2) } : s
        }),
      }
    })
  }, [data.productos, pendientes])

  const frecuentes = useMemo(() => {
    if (!data.consumos) return []
    const desde = Date.now() - 60 * 86400000
    const cuenta = new Map()
    data.consumos.filter((c) => c.usuario === usuario.id && !esAnulado(c) && parseDate(c.fecha).getTime() >= desde)
      .forEach((c) => cuenta.set(c.producto, (cuenta.get(c.producto) ?? 0) + 1))
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id)
  }, [data.consumos, usuario.id])

  const bodegas = (data.bodegas ?? []).filter((b) => b.estado !== false)
  const producto = productos.find((p) => p.id === prodId)
  const opciones = producto ? bodegas.map((b) => ({ ...b, hay: stockEn(producto, b.id) })).filter((b) => b.hay > 0) : []
  const bodega = bodegas.find((b) => String(b.id) === String(bodegaId))
  const hayEnBodega = producto && bodega ? stockEn(producto, bodega.id) : 0
  const cant = Number(cantidad)

  const elegir = (p) => {
    setProdId(p.id); setCantidad(''); setErrorEnvio(''); setHecho(null)
    const mejor = bodegas.map((b) => ({ id: b.id, hay: stockEn(p, b.id) })).sort((a, b) => b.hay - a.hay)[0]
    setBodegaId(mejor?.hay > 0 ? mejor.id : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const limpiar = () => { setProdId(null); setBodegaId(''); setCantidad(''); setErrorEnvio('') }

  useEffect(() => { if (producto && bodegaId && stockEn(producto, bodegaId) <= 0) setBodegaId('') }, [producto, bodegaId])

  let problema = ''
  if (producto && bodega) {
    if (!(cant > 0)) problema = 'Escribe cuánto vas a retirar.'
    else if (cant > hayEnBodega) problema = `En ${bodega.nombre} solo hay ${num(hayEnBodega)} ${producto.unidad_medida}.`
  } else if (producto) problema = 'Elige de qué bodega lo sacas.'
  const quedara = producto && bodega && cant > 0 ? hayEnBodega - cant : null
  const bajoMinimo = quedara != null && quedara >= 0 && producto && Number(producto.stock_actual) - cant < Number(producto.stock_minimo)

  const confirmar = async () => {
    if (problema || enviando) return
    setEnviando(true); setErrorEnvio('')
    try {
      const r = await registrarSalida({ producto: producto.id, bodega: bodega.id, usuario: usuario.id, cantidad: cant })
      setHecho({ producto, bodega, cantidad: cant, enCola: r.enCola, fecha: r.consumo?.fecha ? new Date(r.consumo.fecha) : new Date(), restante: hayEnBodega - cant })
      toast(r.enCola ? 'Sin conexión: el retiro quedó guardado y se enviará solo.' : 'Retiro registrado', r.enCola ? 'cola' : 'ok')
      limpiar()
      reload()
    } catch (e) {
      setErrorEnvio(e.message || 'No se pudo registrar el retiro.')
    } finally { setEnviando(false) }
  }

  const cabecera = <PageHeader title="Registrar consumo" subtitle="Elige el insumo, la bodega y la cantidad. Revisa la vista previa y confirma." />
  if (loading && !data.productos) return <>{cabecera}<Estado cargando /></>
  if (error && !data.productos) return <>{cabecera}<Estado error={error} /></>

  if (hecho) {
    return (
      <>
        {cabecera}
        <section className="card hecho" role="status">
          <span className={`hecho__icon ${hecho.enCola ? 'hecho__icon--cola' : ''}`}>{hecho.enCola ? <WifiOff size={40} /> : <CircleCheck size={44} strokeWidth={2} />}</span>
          <h2>{hecho.enCola ? 'Guardado en el teléfono' : 'Retiro registrado'}</h2>
          <p>{hecho.enCola ? 'No hay internet. Se enviará solo apenas vuelva la conexión.' : 'Quedó guardado con la fecha y hora de abajo.'}</p>
          <dl className="resumen-registro">
            <div><dt>Insumo</dt><dd>{hecho.producto.nombre}</dd></div>
            <div><dt>Cantidad</dt><dd>{num(hecho.cantidad)} {hecho.producto.unidad_medida}</dd></div>
            <div><dt>Bodega</dt><dd>{hecho.bodega.nombre}</dd></div>
            <div><dt>Registrado por</dt><dd>{usuario.nombre_completo}</dd></div>
            <div><dt>Fecha y hora</dt><dd>{fechaLarga(hecho.fecha)}, {horaCompleta(hecho.fecha)}</dd></div>
            {!hecho.enCola && <div><dt>Quedan en la bodega</dt><dd>{num(hecho.restante)} {hecho.producto.unidad_medida}</dd></div>}
          </dl>
          <div className="hecho__actions">
            <button type="button" className="btn btn--primary btn--xl" onClick={() => setHecho(null)}><PackageMinus size={26} /> Registrar otro retiro</button>
            <Link className="btn btn--secondary btn--lg" to="/historial">Ver {esAdmin(usuario) ? 'historial' : 'mis retiros'}</Link>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      {cabecera}
      <div className={`consumo ${producto ? 'consumo--elegido' : ''}`}>
        <section className="card consumo__lista" aria-label="Elegir insumo">
          <h2 className="paso"><span>1</span> ¿Qué insumo vas a retirar?</h2>
          <ProductoPicker productos={productos} onSelect={elegir} seleccionadoId={prodId} frecuentes={frecuentes} sinStockBloquea />
        </section>

        <aside className="consumo__panel" aria-label="Detalle del retiro">
          {!producto ? (
            <div className="card consumo__vacio">
              <PackageMinus size={40} strokeWidth={1.5} />
              <p>Toca un insumo de la lista para empezar.</p>
            </div>
          ) : (
            <div className="card consumo__form">
              <div className="elegido">
                <div className="elegido__top">
                  <div className="elegido__info">
                    <span className="elegido__name">{producto.nombre}</span>
                    <span className="elegido__meta">{producto.codigo} · {producto.categoria} · Total: {num(producto.stock_actual)} {producto.unidad_medida}</span>
                  </div>
                  <button type="button" className="elegido__cambiar only-mobile" onClick={limpiar}>
                    <ArrowLeft size={18} /> Cambiar
                  </button>
                </div>
              </div>

              <h2 className="paso"><span>2</span> ¿De qué bodega?</h2>
              <div className="bodegas-opt" role="radiogroup" aria-label="Bodega">
                {opciones.map((b) => (
                  <button type="button" key={b.id} role="radio" aria-checked={String(bodegaId) === String(b.id)} className={`bodega-btn ${String(bodegaId) === String(b.id) ? 'bodega-btn--on' : ''}`} onClick={() => setBodegaId(b.id)}>
                    <b>{b.nombre}</b><span>{num(b.hay)} {producto.unidad_medida} disponibles</span>
                  </button>
                ))}
              </div>

              <h2 className="paso"><span>3</span> ¿Cuánto retiras?</h2>
              <Cantidad value={cantidad} onChange={setCantidad} unidad={producto.unidad_medida} max={hayEnBodega || undefined} id="cantidad-retiro" />
              {problema && cantidad !== '' && <p className="msg msg--error" role="alert"><TriangleAlert size={20} /> {problema}</p>}
              {bajoMinimo && !problema && <p className="msg msg--warn" role="status"><TriangleAlert size={20} /> Con este retiro el insumo quedará por debajo del mínimo ({num(producto.stock_minimo)} {producto.unidad_medida}).</p>}

              <h2 className="paso"><span>4</span> Revisa y confirma</h2>
              <div className="preview" aria-label="Vista previa del registro">
                <div className="preview__lock"><Lock size={16} /> Vista previa · estos datos los pone el sistema y no se pueden editar</div>
                <dl className="preview__list">
                  <div><dt><CalendarClock size={18} /> Fecha</dt><dd>{fechaLarga(ahora)}</dd></div>
                  <div><dt><CalendarClock size={18} /> Hora</dt><dd className="mono">{horaCompleta(ahora)}</dd></div>
                  <div><dt><UserRound size={18} /> Registrado por</dt><dd>{usuario.nombre_completo}</dd></div>
                  <div><dt>Insumo</dt><dd>{producto.nombre}</dd></div>
                  <div><dt>Bodega</dt><dd>{bodega?.nombre ?? '—'}</dd></div>
                  <div><dt>Cantidad</dt><dd>{cant > 0 ? `${num(cant)} ${producto.unidad_medida}` : '—'}</dd></div>
                  {quedara != null && quedara >= 0 && <div><dt>Quedará en la bodega</dt><dd>{num(quedara)} {producto.unidad_medida}</dd></div>}
                </dl>
                <p className="preview__note">La hora exacta queda fijada cuando tocas “Confirmar retiro”.</p>
              </div>

              {errorEnvio && <p className="msg msg--error" role="alert"><TriangleAlert size={20} /> {errorEnvio}</p>}
              <button type="button" className="btn btn--primary btn--xl btn--block" onClick={confirmar} disabled={!!problema || enviando}>
                {enviando ? 'Guardando…' : <><CircleCheck size={28} /> Confirmar retiro</>}
              </button>
              {problema && cantidad === '' && <p className="hint hint--center">{problema}</p>}
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
