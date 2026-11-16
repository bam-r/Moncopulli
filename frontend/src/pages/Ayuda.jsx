import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/ui'
import { esAdmin } from '../lib/format'

const PASOS = ({ children }) => <ol className="steps">{children}</ol>

const PARA_TODOS = [
  { p: 'Cómo registrar un consumo (retiro de un insumo)', r: (
    <PASOS>
      <li>Entra a <b>Registrar consumo</b> (primer botón del menú; en el celular, abajo a la izquierda).</li>
      <li>Busca el insumo por nombre o filtra por categoría. Toca el que vas a retirar.</li>
      <li>Elige la bodega y la cantidad con los botones grandes (− / +).</li>
      <li>Revisa la vista previa: la fecha, la hora y tu nombre los pone el sistema y no se pueden cambiar. Presiona <b>Confirmar retiro</b>.</li>
    </PASOS>
  ) },
  { p: 'Me equivoqué en un retiro, ¿qué hago?', r: (
    <p>Avísale al administrador: solo él puede anular un retiro (Historial → Anular). El retiro queda marcado como anulado con el motivo y el stock vuelve a la bodega. Mira tus retiros en <b>Mis retiros</b>.</p>
  ) },
  { p: 'Qué significan los estados del stock', r: (
    <ul className="plain">
      <li><b>Disponible:</b> hay más cantidad que el mínimo definido para el insumo.</li>
      <li><b>Stock bajo:</b> queda menos que el mínimo.</li>
      <li><b>Sin stock:</b> la cantidad llegó a 0 y hay que reponer.</li>
    </ul>
  ) },
  { p: 'Qué hago si no tengo internet', r: (
    <p>Puedes seguir registrando consumos. Quedan guardados con la hora en que los hiciste en tu teléfono, aparece un aviso amarillo con la cantidad pendiente, y se envían solas cuando vuelve la conexión. Mientras tanto, el stock que ves ya descuenta lo que retiraste.</p>
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
      <li>Entra a <b>Registrar compra</b> en el menú.</li>
      <li>Elige el proveedor, la bodega donde queda lo comprado, el tipo de documento, el N° y la fecha.</li>
      <li>Con <b>Agregar insumo</b> busca cada insumo y anota cantidad y precio. Revisa la vista previa y confirma: el stock sube en esa bodega.</li>
    </PASOS>
  ) },
  { p: 'Cómo agregar un insumo nuevo o un usuario', r: (
    <p>En <b>Stock</b> usa <b>Añadir insumo</b> (código, nombre, categoría, unidad, costo, stock mínimo y, si ya tiene stock, la bodega donde está). En <b>Usuarios</b> usa <b>Añadir usuario</b>: el rol define si ve todo el menú (Administrador) o solo Registrar consumo, Stock y Mis retiros (Trabajador).</p>
  ) },
  { p: 'Cómo hacer un inventario (conteo físico)', r: (
    <PASOS>
      <li>En <b>Inventario</b> presiona <b>Registrar inventario</b>, elige la bodega y la fecha.</li>
      <li>Escribe el stock real contado de cada insumo de esa bodega; la diferencia con lo que dice el sistema se calcula sola.</li>
      <li>Guarda. El inventario queda registrado; no cambia el stock actual por sí solo.</li>
    </PASOS>
  ) },
  { p: 'Cómo anular un inventario', r: (
    <p>En <b>Inventario</b> presiona <b>Anular</b> en la fila y escribe el motivo. Nada se borra: queda marcado como anulado con el motivo, la fecha y quién lo anuló.</p>
  ) },
  { p: 'Cómo sacar reportes', r: (
    <p>En <b>Reportes</b> elige el tipo (Retiros, Compras, Stock o Desviación), el período (semana, mes o 3 meses) y, si quieres, una persona. Cada gráfico tiene <b>Ver tabla</b>; con <b>Descargar Excel</b> bajas los datos y con <b>Imprimir / PDF</b> guardas el reporte.</p>
  ) },
  { p: 'Cómo ver cuánto hay en cada bodega', r: (
    <p>En <b>Bodegas</b> elige una bodega para ver su contenido. En <b>Stock</b> puedes cambiar a la vista <b>Por bodega</b> para ver todas las columnas juntas. El total de cada insumo es la suma de sus bodegas.</p>
  ) },
  { p: 'Cómo anular un retiro', r: (
    <p>En <b>Historial</b> filtra por Retiros, busca el registro y presiona <b>Anular</b>. Escribe el motivo: el stock vuelve a la bodega de la que salió y el registro queda marcado como anulado.</p>
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
