import secrets
import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import (
    ApiToken, Bodega, Consumo, DetalleDocumento, DetalleInventario, DocumentoCompra,
    Inventario, PreferenciasPrivacidad, ProduccionLeche, Producto, Proveedor,
    RegistroAccesoDatos, RegistroConsentimiento, StockBodega, Usuario,
)
from .serializers import (
    BodegaSerializer, ConsumoSerializer, DetalleDocumentoSerializer, DetalleInventarioSerializer,
    DocumentoCompraSerializer, InventarioSerializer, ProduccionLecheSerializer, ProductoSerializer,
    ProveedorSerializer, StockBodegaSerializer, UsuarioSerializer,
)
from .permissions import AdministradorEscritura, SoloAdministradores, UsuarioActivo
from .servicios import esta_activo


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [SoloAdministradores]

    def list(self, request, *args, **kwargs):
        RegistroAccesoDatos.objects.create(usuario=request.user, accion="LECTURA_PROVEEDORES")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        proveedor = self.get_object()
        RegistroAccesoDatos.objects.create(usuario=request.user, accion="LECTURA_PROVEEDOR")
        serializer = self.get_serializer(proveedor)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save()
        RegistroAccesoDatos.objects.create(usuario=self.request.user, accion="ALTA_PROVEEDOR")

    def perform_update(self, serializer):
        serializer.save()
        RegistroAccesoDatos.objects.create(usuario=self.request.user, accion="CAMBIO_PROVEEDOR")

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        RegistroAccesoDatos.objects.create(usuario=self.request.user, accion="BAJA_PROVEEDOR")


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = [SoloAdministradores]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def list(self, request, *args, **kwargs):
        RegistroAccesoDatos.objects.create(usuario=request.user, accion="LECTURA_USUARIOS")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        usuario = self.get_object()
        RegistroAccesoDatos.objects.create(
            usuario=request.user, usuario_objetivo=usuario, accion="LECTURA_USUARIO"
        )
        return Response(self.get_serializer(usuario).data)

    def perform_create(self, serializer):
        usuario = serializer.save()
        RegistroAccesoDatos.objects.create(
            usuario=self.request.user, usuario_objetivo=usuario, accion="ALTA_USUARIO"
        )

    def perform_update(self, serializer):
        usuario = serializer.save()
        RegistroAccesoDatos.objects.create(
            usuario=self.request.user, usuario_objetivo=usuario, accion="CAMBIO_USUARIO"
        )


class BodegaViewSet(viewsets.ModelViewSet):
    queryset = Bodega.objects.all()
    serializer_class = BodegaSerializer
    permission_classes = [AdministradorEscritura]


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.prefetch_related("stocks").all()
    serializer_class = ProductoSerializer
    permission_classes = [AdministradorEscritura]


class StockBodegaViewSet(viewsets.ReadOnlyModelViewSet):
    """Cuánto hay de cada producto en cada bodega. Filtros: ?producto=ID&bodega=ID"""

    serializer_class = StockBodegaSerializer

    def get_queryset(self):
        qs = StockBodega.objects.all().order_by("bodega_id", "producto_id")
        for campo in ("producto", "bodega"):
            valor = self.request.query_params.get(campo)
            if valor and valor.isdigit():
                qs = qs.filter(**{f"{campo}_id": int(valor)})
        return qs


class DetalleDocumentoViewSet(viewsets.ModelViewSet):
    queryset = DetalleDocumento.objects.all()
    serializer_class = DetalleDocumentoSerializer
    # Una línea de compra ya movió stock: solo se consulta o se crea.
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [SoloAdministradores]


class DocumentoCompraViewSet(viewsets.ModelViewSet):
    queryset = DocumentoCompra.objects.prefetch_related("detalles").all()
    serializer_class = DocumentoCompraSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [SoloAdministradores]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class ProduccionLecheViewSet(viewsets.ModelViewSet):
    queryset = ProduccionLeche.objects.all()
    serializer_class = ProduccionLecheSerializer
    permission_classes = [SoloAdministradores]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class ConsumoViewSet(viewsets.ModelViewSet):
    queryset = Consumo.objects.all()
    serializer_class = ConsumoSerializer
    permission_classes = [UsuarioActivo]
    # Un consumo no se edita ni se borra: se anula (PATCH) y queda el registro.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Consumo.objects.all()
        if self.request.user.rol.upper() != "ADMIN":
            queryset = queryset.filter(usuario=self.request.user)
        return queryset

    def create(self, request, *args, **kwargs):
        if request.user.rol.upper() != "ADMIN" and not esta_activo(request.user):
            return Response({"detail": "Usuario inactivo."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.rol.upper() != "ADMIN":
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Solo un administrador puede anular un consumo.")
        serializer.save()


class InventarioViewSet(viewsets.ModelViewSet):
    queryset = Inventario.objects.prefetch_related("detalles").all()
    serializer_class = InventarioSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_classes = [SoloAdministradores]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class DetalleInventarioViewSet(viewsets.ModelViewSet):
    queryset = DetalleInventario.objects.all()
    serializer_class = DetalleInventarioSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [SoloAdministradores]


def _solo_rut(texto):
    return "".join(c for c in str(texto) if c.isalnum()).upper()


def _contrasena_correcta(usuario, ingresada):
    """Compara la contraseña ingresada con el hash almacenado."""
    if not ingresada or len(ingresada) > 1024:
        return False

    def actualizar_hash(password):
        usuario.contrasena = make_password(password)
        usuario.save(update_fields=["contrasena"])

    try:
        return check_password(
            ingresada, usuario.contrasena or "", setter=actualizar_hash
        )
    except ValueError:
        return False


def _registrar_intento_login(request, usuario, autenticado):
    RegistroAccesoDatos.objects.create(
        usuario=usuario if autenticado else None,
        usuario_objetivo=usuario,
        accion="LOGIN_EXITOSO" if autenticado else "LOGIN_FALLIDO",
        ip_origen=request.META.get("REMOTE_ADDR"),
    )


class LoginThrottle(AnonRateThrottle):
    scope = "login"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
@transaction.atomic
def login(request):
    """POST /api/auth/login/  {rut, contrasena} -> {usuario}"""
    rut = _solo_rut(request.data.get("rut", ""))
    contrasena = str(request.data.get("contrasena", ""))
    invalido = Response({"detail": "RUT o contraseña incorrectos."}, status=status.HTTP_400_BAD_REQUEST)
    if not rut or not contrasena:
        _registrar_intento_login(request, None, False)
        return invalido
    usuario = next((u for u in Usuario.objects.all() if _solo_rut(u.rut) == rut), None)
    if usuario is None or not _contrasena_correcta(usuario, contrasena):
        _registrar_intento_login(request, usuario, False)
        return invalido
    if not esta_activo(usuario):
        _registrar_intento_login(request, usuario, False)
        return Response({"detail": "Tu usuario está inactivo. Contacta al administrador."}, status=status.HTTP_403_FORBIDDEN)
    secreto = secrets.token_urlsafe(32)
    ApiToken.crear(usuario, secreto)
    _registrar_intento_login(request, usuario, True)
    return Response({"usuario": UsuarioSerializer(usuario).data, "token": secreto})


@api_view(["GET"])
@permission_classes([UsuarioActivo])
def usuario_actual(request):
    RegistroAccesoDatos.objects.create(
        usuario=request.user, usuario_objetivo=request.user, accion="LECTURA_PERFIL"
    )
    return Response(UsuarioSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([UsuarioActivo])
def logout(request):
    request.auth.revocado_en = timezone.now()
    request.auth.save(update_fields=["revocado_en"])
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([UsuarioActivo])
def exportar_datos(request):
    usuario = request.user
    RegistroAccesoDatos.objects.create(usuario=usuario, usuario_objetivo=usuario, accion="EXPORTACION")
    return Response(
        {
            "exportado_en_utc": timezone.now(),
            "usuario": UsuarioSerializer(usuario).data,
            "produccion_leche": ProduccionLecheSerializer(
                ProduccionLeche.objects.filter(usuario=usuario), many=True
            ).data,
            "consumos": ConsumoSerializer(
                Consumo.objects.filter(usuario=usuario), many=True
            ).data,
            "inventarios": InventarioSerializer(
                Inventario.objects.filter(usuario=usuario), many=True
            ).data,
            "documentos_compra": DocumentoCompraSerializer(
                DocumentoCompra.objects.filter(usuario=usuario), many=True
            ).data,
            "preferencias_privacidad": (
                {
                    "marketing": usuario.preferencias_privacidad.marketing,
                    "perfilamiento": usuario.preferencias_privacidad.perfilamiento,
                    "actualizada_en": usuario.preferencias_privacidad.actualizada_en,
                }
                if hasattr(usuario, "preferencias_privacidad")
                else {"marketing": False, "perfilamiento": False, "actualizada_en": None}
            ),
            "consentimientos": list(
                RegistroConsentimiento.objects.filter(usuario=usuario).values(
                    "finalidad", "version_politica", "fecha_hora_utc", "ip_origen", "estado"
                )
            ),
            "accesos_a_datos": list(
                RegistroAccesoDatos.objects.filter(
                    Q(usuario=usuario) | Q(usuario_objetivo=usuario)
                ).values("accion", "fecha_hora_utc")
            ),
            "sesiones": list(
                ApiToken.objects.filter(usuario=usuario).values(
                    "creado_en", "expira_en", "revocado_en"
                )
            ),
        },
        headers={"Cache-Control": "no-store"},
    )


@api_view(["PATCH"])
@permission_classes([UsuarioActivo])
def actualizar_perfil(request):
    usuario = request.user
    email = request.data.get("email", usuario.email)
    telefono = request.data.get("telefono", usuario.telefono)
    if not isinstance(email, str) or len(email) > 80:
        return Response({"email": ["Ingresa un correo válido."]}, status=status.HTTP_400_BAD_REQUEST)
    if email:
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"email": ["Ingresa un correo válido."]}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(telefono, str) or len(telefono) > 15 or not telefono.strip():
        return Response({"telefono": ["Ingresa un teléfono válido."]}, status=status.HTTP_400_BAD_REQUEST)
    usuario.email = email.strip()
    usuario.telefono = telefono.strip()
    usuario.save(update_fields=["email", "telefono"])
    RegistroAccesoDatos.objects.create(
        usuario=usuario, usuario_objetivo=usuario, accion="ACTUALIZACION_PERFIL"
    )
    return Response(UsuarioSerializer(usuario).data)


@api_view(["PATCH"])
@permission_classes([UsuarioActivo])
def cambiar_contrasena(request):
    actual = str(request.data.get("contrasena_actual", ""))
    nueva = str(request.data.get("contrasena_nueva", ""))
    if not _contrasena_correcta(request.user, actual):
        return Response({"contrasena_actual": ["La contraseña actual no es correcta."]}, status=400)
    if len(nueva) < 10 or len(nueva) > 1024:
        return Response(
            {"contrasena_nueva": ["Usa entre 10 y 1024 caracteres."]}, status=400
        )
    request.user.contrasena = make_password(nueva)
    request.user.save(update_fields=["contrasena"])
    ApiToken.objects.filter(usuario=request.user).exclude(pk=request.auth.pk).update(revocado_en=timezone.now())
    RegistroAccesoDatos.objects.create(
        usuario=request.user, usuario_objetivo=request.user, accion="CAMBIO_CONTRASENA"
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
@permission_classes([UsuarioActivo])
@transaction.atomic
def preferencias_privacidad(request):
    preferencias, _ = PreferenciasPrivacidad.objects.get_or_create(usuario=request.user)
    campos = ("marketing", "perfilamiento")
    if request.method == "PATCH":
        cambios = {}
        for campo in campos:
            if campo not in request.data:
                continue
            valor = request.data[campo]
            if not isinstance(valor, bool):
                return Response({campo: ["Debe ser verdadero o falso."]}, status=400)
            if getattr(preferencias, campo) != valor:
                cambios[campo] = valor
        if cambios:
            ip = request.META.get("REMOTE_ADDR")
            for campo, valor in cambios.items():
                RegistroConsentimiento.objects.create(
                    usuario=request.user,
                    finalidad=campo,
                    version_politica=settings.CONSENT_POLICY_VERSION,
                    ip_origen=ip,
                    estado="otorgado" if valor else "revocado",
                )
            for campo, valor in cambios.items():
                setattr(preferencias, campo, valor)
            preferencias.save(update_fields=[*cambios, "actualizada_en"])
            RegistroAccesoDatos.objects.create(
                usuario=request.user, usuario_objetivo=request.user, accion="CAMBIO_PREFERENCIAS"
            )
    return Response({campo: getattr(preferencias, campo) for campo in campos})


@api_view(["DELETE"])
@permission_classes([UsuarioActivo])
@transaction.atomic
def anonimizar_cuenta(request):
    if not _contrasena_correcta(request.user, str(request.data.get("contrasena_actual", ""))):
        return Response({"contrasena_actual": ["La contraseña actual no es correcta."]}, status=400)
    usuario = Usuario.objects.select_for_update().get(pk=request.user.pk)
    RegistroAccesoDatos.objects.create(
        usuario=usuario, usuario_objetivo=usuario, accion="ANONIMIZACION_CUENTA"
    )
    usuario.rut = f"ANON-{uuid.uuid4().hex}"
    usuario.nombre_completo = "Cuenta anonimizada"
    usuario.puesto = ""
    usuario.departamento = ""
    usuario.telefono = ""
    usuario.email = ""
    usuario.contrasena = None
    usuario.rol = "TRABAJADOR"
    usuario.estado = "Inactivo"
    usuario.save()
    ApiToken.objects.filter(usuario=usuario).update(revocado_en=timezone.now())
    PreferenciasPrivacidad.objects.filter(usuario=usuario).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
