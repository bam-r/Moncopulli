import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/ui'
import { esAdmin } from '../lib/format'

const PASOS = ({ children }) => <ol className="steps">{children}</ol>

const PARA_TODOS = [
  { p: 'Cómo registrar una salida (retiro de un insumo)', r: (
    <PASOS>
      <li>Entra a <b>Stock</b> y presiona <b>Registrar salida</b>.</li>
      <li>Elige el insumo, escribe la cantidad que retiras y revisa la bodega.</li>
      <li>Presiona <b>Registrar salida</b>. El stock se descuenta y el retiro queda a tu nombre.</li>
    </PASOS>
  ) },
  { p: 'Qué significan los estados del stock', r: (
    <ul className="plain">
      <li><b>Disponible:</b> hay más cantidad que el mínimo definido para el insumo.</li>
      <li><b>Stock bajo:</b> queda menos que el mínimo.</li>
      <li><b>Sin stock:</b> la cantidad llegó a 0 y hay que reponer.</li>
    </ul>
  ) },
  { p: 'Qué hago si no tengo internet', r: (
    <p>Puedes seguir registrando salidas. Quedan guardadas en tu teléfono, aparece un aviso amarillo con la cantidad pendiente, y se envían solas cuando vuelve la conexión. Mientras tanto, el stock que ves ya descuenta lo que retiraste.</p>
  ) },
  { p: 'Cómo instalar la aplicación en el teléfono', r: (
    <ul className="plain">
      <li><b>Android (Chrome):</b> menú ⋮ → <b>Instalar aplicación</b> (o <b>Agregar a la pantalla principal</b>).</li>
      <li><b>iPhone (Safari):</b> botón Compartir → <b>Añadir a pantalla de inicio</b>.</li>
    </ul>
  ) },
  { p: 'Olvidé mi contraseña o no puedo entrar', r: (
    <p>Contacta al administrador del predio para que revise tu usuario. Ingresa siempre con tu RUT completo, incluido el dígito verificador. Si la recuerdas y solo quieres cambiarla, hazlo en Configuración → Cambiar contraseña.</p>
  ) },
]

const PARA_ADMIN = [
  { p: 'Cómo agregar una compra', r: (
    <PASOS>
      <li>Presiona <b>Agregar Compra</b> en Resumen o Stock.</li>
      <li>Elige el proveedor, el tipo de documento, el N° de folio y la fecha.</li>
      <li>Agrega una línea por cada insumo (cantidad y precio unitario) y guarda. El stock de esos insumos aumenta.</li>
    </PASOS>
  ) },
  { p: 'Cómo agregar un insumo nuevo o un usuario', r: (
    <p>En <b>Stock</b> usa <b>Añadir insumo</b> (código, nombre, categoría, unidad, costo y stock mínimo). En <b>Usuarios</b> usa <b>Añadir usuario</b>: el rol define si ve todo el menú (Administrador) o solo Stock (Trabajador).</p>
  ) },
  { p: 'Cómo hacer un inventario (conteo físico)', r: (
    <PASOS>
      <li>En <b>Inventario</b> presiona <b>Registrar inventario</b>, elige la bodega y la fecha.</li>
      <li>Escribe el stock real contado de cada insumo; la diferencia con el sistema se calcula sola.</li>
      <li>Guarda. El inventario queda registrado; no cambia el stock actual por sí solo.</li>
    </PASOS>
  ) },
  { p: 'Cómo anular un inventario', r: (
    <p>En <b>Inventario</b> presiona <b>Anular</b> en la fila y escribe el motivo. Nada se borra: queda marcado como anulado con el motivo, la fecha y quién lo anuló.</p>
  ) },
  { p: 'Cómo sacar reportes', r: (
    <p>En <b>Reportes</b> elige el período arriba a la derecha. Cada gráfico tiene <b>Ver tabla</b> para ver los números exactos y los de consumo y compras se pueden bajar con <b>Exportar CSV</b> (se abre en Excel).</p>
  ) },
  { p: 'Cómo desactivar un proveedor o una bodega', r: (
    <p>Los proveedores se desactivan desde su ficha (clic en el nombre, en Proveedores) y las bodegas desde Configuración. Dejan de aparecer en los formularios nuevos, pero su historial se conserva.</p>
  ) },
]

export default function Ayuda() {
  const { usuario } = useAuth()
  const admin = esAdmin(usuario)
  const grupo = (titulo, items) => (
    <section className="card faq">
      <h2>{titulo}</h2>
      {items.map((i) => (
        <details key={i.p}>
          <summary>{i.p}</summary>
          <div className="faq__body">{i.r}</div>
        </details>
      ))}
    </section>
  )
  return (
    <>
      <PageHeader title="Ayuda" subtitle="Respuestas rápidas para usar Moncopulli." />
      <div className="help">
        {grupo('Para todos', PARA_TODOS)}
        {admin && grupo('Para administradores', PARA_ADMIN)}
        <section className="card help__contact">
          <h2>¿No encuentras lo que buscas?</h2>
          <p>Habla con el administrador del predio. Si algo no funciona como se explica aquí, cuéntale qué estabas haciendo y qué pantalla veías.</p>
        </section>
      </div>
    </>
  )
}
