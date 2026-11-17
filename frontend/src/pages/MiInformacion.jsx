import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileCheck, History, Printer, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { exportarDatos, listar } from '../api/services'
import { leerPendientes } from '../api/pending'
import { Badge, Estado, PageHeader, StatCard } from '../components/ui'
import { useToast } from '../components/Toast'
import { dmy, esAdmin, esAnulado, hm, num, parseDate } from '../lib/format'

const ETIQUETAS_ACCION = {
  LOGIN_EXITOSO: 'Inicio de sesión exitoso',
  LOGIN_FALLIDO: 'Intento de inicio de sesión fallido',
  LECTURA_PERFIL: 'Consulta de perfil propio',
  ACTUALIZACION_PERFIL: 'Actualización de datos de contacto',
  CAMBIO_CONTRASENA: 'Cambio de contraseña',
  CAMBIO_PREFERENCIAS: 'Actualización de preferencias de privacidad',
  EXPORTACION: 'Solicitud de acceso / portabilidad de datos',
  LECTURA_USUARIO: 'Consulta administrativa de ficha de usuario',
  LECTURA_USUARIOS: 'Listado administrativo de usuarios',
  ALTA_USUARIO: 'Creación de cuenta de usuario',
  CAMBIO_USUARIO: 'Modificación administrativa de usuario',
  ANONIMIZACION_CUENTA: 'Seudonimización / baja de perfil',
}

const ETIQUETAS_FINALIDAD = {
  marketing: 'Comunicaciones de marketing',
  perfilamiento: 'Perfilamiento opcional',
}

function fechaHora(valor) {
  if (!valor) return '—'
  const d = parseDate(valor)
  return Number.isNaN(d.getTime()) ? '—' : `${dmy(d)} · ${hm(d)}`
}

export default function MiInformacion() {
  const { usuario } = useAuth()
  const toast = useToast()
  const [expediente, setExpediente] = useState(null)
  const [productos, setProductos] = useState([])
  const [bodegas, setBodegas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setCargando(true)
    setError('')
    Promise.all([
      exportarDatos(),
      listar('productos').catch(() => []),
      listar('bodegas').catch(() => []),
    ])
      .then(([datos, prods, bods]) => {
        setExpediente(datos)
        setProductos(prods)
        setBodegas(bods)
      })
      .catch((e) => setError(e.message || 'No se pudo obtener tu información personal.'))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const mapaProductos = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const mapaBodegas = useMemo(() => new Map(bodegas.map((b) => [b.id, b])), [bodegas])

  const pendientesOffline = useMemo(
    () =>
      leerPendientes()
        .filter((item) => String(item.usuario) === String(usuario.id))
        .map(({ _local, ...item }) => item),
    [usuario.id]
  )

  const descargarJSON = () => {
    if (!expediente) return
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ ...expediente, operaciones_pendientes_offline: pendientesOffline }, null, 2)],
        { type: 'application/json' }
      )
    )
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `moncopulli-portabilidad-${usuario.rut}.json`
    enlace.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('Archivo JSON de portabilidad descargado')
  }

  const exportarPDF = () => {
    window.print()
  }

  const acciones = (
    <>
      <button type="button" className="btn btn--secondary" onClick={descargarJSON} disabled={!expediente}>
        <Download size={20} /> Descargar JSON
      </button>
      <button type="button" className="btn btn--primary" onClick={exportarPDF} disabled={!expediente}>
        <Printer size={20} /> Exportar como PDF
      </button>
    </>
  )

  const cabecera = (
    <PageHeader
      title="Mi información"
      subtitle="Derecho de acceso y portabilidad de datos personales (Ley N° 21.719). Revisa los datos asociados a tu cuenta y expórtalos en PDF o JSON."
      actions={acciones}
    />
  )

  if (cargando && !expediente) return <>{cabecera}<Estado cargando /></>
  if (error && !expediente) return <>{cabecera}<Estado error={error} /></>

  const titular = expediente.usuario ?? usuario
  const pref = expediente.preferencias_privacidad ?? { marketing: false, perfilamiento: false, actualizada_en: null }
  const consumos = [...(expediente.consumos ?? [])].sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha))
  const consentimientos = [...(expediente.consentimientos ?? [])].sort((a, b) => parseDate(b.fecha_hora_utc) - parseDate(a.fecha_hora_utc))
  const accesos = [...(expediente.accesos_a_datos ?? [])].sort((a, b) => parseDate(b.fecha_hora_utc) - parseDate(a.fecha_hora_utc))
  const sesiones = [...(expediente.sesiones ?? [])].sort((a, b) => parseDate(b.creado_en) - parseDate(a.creado_en))
  const consentimientosActivos = (pref.marketing ? 1 : 0) + (pref.perfilamiento ? 1 : 0)
  const fechaEmision = expediente.exportado_en_utc ? parseDate(expediente.exportado_en_utc) : new Date()

  return (
    <div className="info-page">
      {cabecera}

      <div className="print-head">
        <b>Informe de Acceso y Portabilidad de Datos Personales (Ley N° 21.719) · Agrícola Moncopulli</b>
        <span>
          Titular: {titular.nombre_completo} (RUT {titular.rut}) · Generado el {dmy(fechaEmision)} a las {hm(fechaEmision)} hrs
        </span>
      </div>

      <div className="stats stats--4">
        <StatCard
          icon={UserRound}
          label="Estado de la cuenta"
          value={titular.estado || 'Activo'}
          note={`Rol: ${esAdmin(titular) ? 'Administrador' : 'Trabajador'}`}
        />
        <StatCard
          icon={History}
          tone="neutral"
          label="Retiros registrados"
          value={consumos.length}
          note={pendientesOffline.length ? `${pendientesOffline.length} pendiente(s) en teléfono` : 'Asociados a tu usuario'}
        />
        <StatCard
          icon={FileCheck}
          tone="neutral"
          label="Consentimientos activos"
          value={`${consentimientosActivos} de 2`}
          note={consentimientosActivos === 0 ? 'Solo tratamiento operacional' : 'Finalidades opcionales activas'}
        />
        <StatCard
          icon={ShieldCheck}
          tone="primary"
          label="Eventos de auditoría"
          value={accesos.length}
          note={`${sesiones.length} ${sesiones.length === 1 ? 'sesión registrada' : 'sesiones registradas'}`}
        />
      </div>

      <div className="info-grid">
        <section className="card settings-card">
          <header>
            <h2>Derecho de acceso y portabilidad (Ley N° 21.719)</h2>
            <p className="sub">Resumen del tratamiento de tus datos personales en el sistema de gestión de stock.</p>
          </header>
          <ul className="plain">
            <li>
              <b>Derecho de acceso:</b> Tienes derecho a conocer qué datos de identificación, contacto y operación mantiene Agrícola Moncopulli sobre tu cuenta, así como el registro de consentimientos y accesos a tu ficha.
            </li>
            <li>
              <b>Derecho de portabilidad:</b> Puedes descargar esta información como documento legible (<b>Exportar como PDF</b>) o en un archivo estructurado e interoperable (<b>Descargar JSON</b>). Por seguridad, el reporte nunca incluye el hash de tu contraseña.
            </li>
            <li>
              <b>Finalidad del tratamiento:</b> Control de inventario, registro y trazabilidad de retiros de insumos en bodegas y seguridad de acceso al sistema.
            </li>
          </ul>
        </section>

        <section className="card settings-card">
          <header>
            <h2>1. Datos de identificación, contacto y cargo</h2>
            <p className="sub">Información registrada en tu ficha de usuario.</p>
          </header>
          <dl className="kv">
            <div className="kv__item"><dt>ID interno</dt><dd>#{titular.id}</dd></div>
            <div className="kv__item"><dt>Nombre completo</dt><dd>{titular.nombre_completo}</dd></div>
            <div className="kv__item"><dt>RUT</dt><dd>{titular.rut}</dd></div>
            <div className="kv__item"><dt>Estado</dt><dd><Badge tone="success">{titular.estado}</Badge></dd></div>
            <div className="kv__item"><dt>Puesto / Cargo</dt><dd>{titular.puesto || '—'}</dd></div>
            <div className="kv__item"><dt>Departamento</dt><dd>{titular.departamento || '—'}</dd></div>
            <div className="kv__item"><dt>Correo electrónico</dt><dd>{titular.email || '—'}</dd></div>
            <div className="kv__item"><dt>Teléfono</dt><dd>{titular.telefono || '—'}</dd></div>
          </dl>
        </section>

        <section className="card settings-card settings-card--table">
          <header>
            <h2>2. Preferencias de privacidad e historial de consentimientos</h2>
            <p className="sub">
              Comunicaciones de marketing: <b>{pref.marketing ? 'Otorgado' : 'No otorgado'}</b> · Perfilamiento opcional:{' '}
              <b>{pref.perfilamiento ? 'Otorgado' : 'No otorgado'}</b>
              {pref.actualizada_en ? ` · Última actualización: ${fechaHora(pref.actualizada_en)}` : ''}
            </p>
          </header>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Finalidad</th>
                  <th>Estado</th>
                  <th>Versión política</th>
                  <th>IP origen</th>
                </tr>
              </thead>
              <tbody>
                {consentimientos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">No se registran cambios en finalidades opcionales (desactivadas por defecto).</td>
                  </tr>
                )}
                {consentimientos.map((c, idx) => (
                  <tr key={`${c.fecha_hora_utc}-${idx}`}>
                    <td className="nowrap">{fechaHora(c.fecha_hora_utc)}</td>
                    <td>{ETIQUETAS_FINALIDAD[c.finalidad] ?? c.finalidad}</td>
                    <td>
                      <Badge tone={c.estado === 'otorgado' ? 'success' : 'warning'}>
                        {c.estado === 'otorgado' ? 'Otorgado' : 'Revocado'}
                      </Badge>
                    </td>
                    <td>v{c.version_politica}</td>
                    <td className="nowrap">{c.ip_origen || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card settings-card settings-card--table">
          <header>
            <h2>3. Registro de retiros de insumos vinculados a tu cuenta ({consumos.length})</h2>
            <p className="sub">Movimientos operacionales asociados a tu identificador de usuario por trazabilidad de bodega.</p>
          </header>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Insumo</th>
                  <th>Bodega</th>
                  <th className="right">Cantidad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {consumos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">No tienes retiros de insumos registrados.</td>
                  </tr>
                )}
                {consumos.slice(0, 50).map((c) => {
                  const prod = mapaProductos.get(c.producto)
                  const bod = mapaBodegas.get(c.bodega)
                  const anulado = esAnulado(c)
                  return (
                    <tr key={c.id} className={anulado ? 'row--muted' : ''}>
                      <td className="nowrap">{fechaHora(c.fecha)}</td>
                      <td>
                        <span className="name">{prod?.nombre ?? `Insumo #${c.producto}`}</span>
                        {prod?.codigo && <span className="sub"> · {prod.codigo}</span>}
                      </td>
                      <td>{bod?.nombre ?? `Bodega #${c.bodega}`}</td>
                      <td className="right num">
                        {num(c.cantidad_retirada)} {prod?.unidad_medida ?? ''}
                      </td>
                      <td>
                        <Badge tone={anulado ? 'danger' : 'success'}>
                          {anulado ? 'Anulado' : 'Confirmado'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {consumos.length > 50 && (
            <p className="sub report-note">
              Se muestran los 50 retiros más recientes en el documento. El archivo JSON incluye los {consumos.length} registros completos.
            </p>
          )}
        </section>

        <section className="card settings-card settings-card--table">
          <header>
            <h2>4. Bitácora de auditoría y accesos a tus datos ({accesos.length})</h2>
            <p className="sub">Registro inmutable de inicios de sesión, consultas y operaciones sobre tus datos personales.</p>
          </header>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Acción registrada</th>
                  <th>Código técnico</th>
                </tr>
              </thead>
              <tbody>
                {accesos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty">No hay eventos registrados.</td>
                  </tr>
                )}
                {accesos.slice(0, 30).map((a, idx) => (
                  <tr key={`${a.fecha_hora_utc}-${idx}`}>
                    <td className="nowrap">{fechaHora(a.fecha_hora_utc)}</td>
                    <td>{ETIQUETAS_ACCION[a.accion] ?? a.accion}</td>
                    <td><span className="chip">{a.accion}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {accesos.length > 30 && (
            <p className="sub report-note">
              Se muestran los 30 eventos más recientes. El archivo JSON incluye los {accesos.length} eventos completos.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
