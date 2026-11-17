# Moncopulli
Software de gestión de stock para predio Moncopulli (Agrícola Moncopulli S.A.).

- **Backend:** Django + Django REST Framework + PostgreSQL (`docker compose up -d`).
- **Frontend:** React + Vite (PWA) en `frontend/`.

Pasos para correrlo y detalle de los últimos cambios: [`docs/CAMBIOS_REVISION_PROFE.md`](docs/CAMBIOS_REVISION_PROFE.md).

## Qué se ha implementado hasta ahora

Moncopulli reúne en un solo lugar el control de productos, bodegas y proveedores,
junto con el registro de compras, consumos e inventarios. El stock se actualiza a
partir de esos movimientos para ayudar a mantener cifras coherentes y dejar un
historial de lo ocurrido.

El acceso se realiza con una cuenta activa y las acciones disponibles dependen
del rol de cada persona. Las contraseñas no se guardan de forma legible: se
protegen con bcrypt y cada sesión puede cerrarse o vence después de 12 horas.

También se incorporaron opciones para que cada persona revise y descargue sus
datos, actualice su correo o teléfono, cambie su contraseña y controle algunas
preferencias opcionales. Si solicita eliminar su cuenta, se quitan sus datos
directos y se cierran sus sesiones; ciertos movimientos conservan una referencia
interna para no perder la historia de la operación. Por eso, este proceso no
equivale a borrar todo rastro ni a anonimizarlo de forma irreversible.

El sistema registra acciones relevantes para poder revisarlas después, pero no
guarda las contraseñas en esos registros. Estas medidas son una base técnica de
protección; todavía deben definirse aspectos organizacionales y de infraestructura
antes de afirmar que existe cumplimiento legal completo.

## Datos personales y privacidad (preparación para Ley N° 21.719)

La aplicación maneja datos de identificación y contacto del personal (RUT, nombre,
correo y teléfono), además de registros operacionales vinculados a usuarios. No se
identifican actualmente campos de salud ni biométricos. Los datos de proveedores y
los registros de compras/inventario deben tratarse como información interna; los
datos identificables de personas requieren acceso restringido. No se debe usar una
copia de producción en desarrollo, QA o staging: usar datos sintéticos.

Controles implementados:

- La API requiere un token bearer aleatorio, almacenado en el servidor solo como
  hash, revocable y con expiración de 12 horas. El navegador lo guarda en
  `sessionStorage`; no persiste el perfil en `localStorage`.
- Usuarios activos pueden consultar/registrar sus propios consumos. Las funciones
  administrativas y la lectura/escritura de usuarios, proveedores, compras,
  producción e inventarios están restringidas al rol administrador. Los actores de
  nuevos movimientos se determinan en el servidor, no por el ID enviado por el
  navegador.
- La consulta/edición administrativa de usuarios y proveedores, la exportación de
  datos y los cambios de cuenta/preferencias generan eventos de auditoría de solo
  anexado. La migración `0007` convierte contraseñas heredadas en texto plano a
  hashes antes de que el servicio vuelva a atender solicitudes; respaldar la base
  de datos de forma cifrada y ejecutar las migraciones antes de desplegar tráfico.
- Las contraseñas nuevas usan bcrypt-SHA256 con costo 12, salt aleatorio integrado
  en el hash y soporte seguro para entradas mayores a 72 bytes. Se limita la entrada
  a 1024 caracteres, y hashes PBKDF2 se actualizan al siguiente inicio de sesión.
  Los intentos exitosos y fallidos guardan usuario objetivo cuando se conoce, hora
  UTC e IP observada, nunca la contraseña. La exportación excluye el hash y la
  supresión de cuenta lo elimina (NULL) e invalida sus tokens.
- El perfil permite actualizar correo/teléfono, cambiar la contraseña tras
  verificar la actual, descargar un JSON de sus registros y solicitar la eliminación
  de identificadores directos confirmada con contraseña. La operación revoca
  sesiones y conserva el identificador interno de movimientos para no alterar su
  trazabilidad; por eso es seudonimización, no anonimización irreversible.
- Las preferencias opcionales de marketing y perfilamiento parten desactivadas.
  Cada cambio añade un evento de consentimiento no editable por la API, con
  finalidad, versión de política, hora UTC, IP observada y estado.
- No se cargan actualmente scripts de analítica ni publicidad ni cookies de
  seguimiento, por lo que no hay scripts no esenciales que habilitar desde un
  banner. Si se incorpora un tercero, debe permanecer bloqueado hasta una elección
  explícita y verificable.
- Secretos y orígenes permitidos se configuran por entorno; no mantener credenciales
  en el repositorio. La API activa redirección HTTPS por defecto fuera de modo
  desarrollo y cookies seguras. Las copias de seguridad y el almacenamiento
  PostgreSQL requieren cifrado y controles configurados en la infraestructura.

Configuración local (PowerShell; usar valores locales propios):

```powershell
$env:DB_PASSWORD = "contraseña-local"
$env:DJANGO_DEBUG = "true"
$env:DJANGO_SECRET_KEY = "clave-local-no-productiva"
docker compose up -d
python manage.py migrate
python manage.py runserver
```

