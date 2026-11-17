import { useMemo, useState } from 'react'
import { CalendarDays, Droplets, Plus, TrendingUp } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useRecursos } from '../api/hooks'
import { Button, Estado, PageHeader, StatCard } from '../components/ui'
import { ColumnChart, GraficoCard } from '../components/charts'
import { LecheModal } from '../components/modals-extra'
import { dmy, miles, num, parseDate } from '../lib/format'
import { enRango, rangoAnterior, rangoUltimos, serieDiaria, sumarDias, inicioDia, variacion } from '../lib/analisis'

export default function Leche() {
  const { usuario } = useAuth()
  const { data, loading, error, reload } = useRecursos(['produccion-leche', 'usuarios'])
  const [modal, setModal] = useState(false)

  const r = useMemo(() => {
    if (!data['produccion-leche']) return null
    const regs = data['produccion-leche'].map((x) => ({ ...x, f: parseDate(x.fecha), l: Number(x.litros) }))
    const suma = (rango) => regs.filter((x) => enRango(x.f, rango)).reduce((s, x) => s + x.l, 0)
    const sem = rangoUltimos(7), semAnt = rangoAnterior(sem), mes = rangoUltimos(30)
    const hoy = inicioDia(new Date())
    const litrosHoy = regs.filter((x) => x.f.getTime() === hoy.getTime()).reduce((s, x) => s + x.l, 0)
    const litrosAyer = regs.filter((x) => x.f.getTime() === sumarDias(hoy, -1).getTime()).reduce((s, x) => s + x.l, 0)
    return {
      regs: [...regs].sort((a, b) => b.f - a.f),
      litrosHoy, litrosAyer, semana: suma(sem), variacionSemana: variacion(suma(sem), suma(semAnt)), mes: suma(mes),
      serie: serieDiaria(regs, { fecha: (x) => x.f, valor: (x) => x.l }, mes),
    }
  }, [data])

  const cabecera = <PageHeader title="Producción de leche" subtitle="Litros producidos por día." actions={<Button icon={Plus} onClick={() => setModal(true)}>Registrar producción</Button>} />
  if (loading && !r) return <>{cabecera}<Estado cargando /></>
  if (error && !r) return <>{cabecera}<Estado error={error} /></>
  const usu = new Map(data.usuarios.map((u) => [u.id, u.nombre_completo]))
  const dif = (v) => (v == null ? 'Sin datos de la semana anterior' : `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1).replace('.', ',')} % vs. semana anterior`)

  return (
    <>
      {cabecera}
      <div className="stats stats--3">
        <StatCard icon={Droplets} label="Hoy" value={`${miles(r.litrosHoy)} L`} note={r.litrosHoy ? `Ayer: ${miles(r.litrosAyer)} L` : 'Aún sin registro de hoy'} />
        <StatCard icon={CalendarDays} tone="neutral" label="Últimos 7 días" value={`${miles(r.semana)} L`} note={dif(r.variacionSemana)} />
        <StatCard icon={TrendingUp} tone="neutral" label="Promedio diario (30 días)" value={`${miles(r.mes / 30)} L`} note={`${miles(r.mes)} L en el mes`} />
      </div>

      <GraficoCard titulo="Últimos 30 días" nota="Litros por día."
        vacio={r.mes === 0 && 'No hay producción registrada en los últimos 30 días.'}
        tabla={{ columnas: ['Fecha', 'Litros'], filas: [...r.serie].reverse().map((d) => [dmy(d.fecha), `${num(d.valor)} L`]) }}>
        <ColumnChart datos={r.serie} unidad="L" />
      </GraficoCard>

      <section className="card table-card" style={{ marginTop: 'var(--space-6)' }}>
        <div className="card__head"><h2>Últimos registros</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th className="right">Litros</th><th>Registró</th><th>Observación</th></tr></thead>
            <tbody>
              {r.regs.length === 0 && <tr><td colSpan={4} className="empty">Todavía no hay registros.</td></tr>}
              {r.regs.slice(0, 15).map((x) => (
                <tr key={x.id}><td className="nowrap">{dmy(x.f)}</td><td className="right num">{num(x.l)} L</td><td>{usu.get(x.usuario) ?? '—'}</td><td>{x.observacion || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {modal && <LecheModal usuario={usuario} onClose={() => setModal(false)} onSaved={reload} />}
    </>
  )
}
