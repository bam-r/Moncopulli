from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.utils.crypto import constant_time_compare
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import (
    Bodega, Consumo, DetalleDocumento, DetalleInventario, DocumentoCompra, Inventario,
    ProduccionLeche, Producto, Proveedor, StockBodega, Usuario,
)
from .serializers import (
    BodegaSerializer, ConsumoSerializer, DetalleDocumentoSerializer, DetalleInventarioSerializer,
    DocumentoCompraSerializer, InventarioSerializer, ProduccionLecheSerializer, ProductoSerializer,
    ProveedorSerializer, StockBodegaSerializer, UsuarioSerializer,
)
from .servicios import esta_activo


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer


class BodegaViewSet(viewsets.ModelViewSet):
    queryset = Bodega.objects.all()
    serializer_class = BodegaSerializer


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.prefetch_related("stocks").all()
    serializer_class = ProductoSerializer


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


class DocumentoCompraViewSet(viewsets.ModelViewSet):
    queryset = DocumentoCompra.objects.prefetch_related("detalles").all()
    serializer_class = DocumentoCompraSerializer
    http_method_names = ["get", "post", "head", "options"]


class ProduccionLecheViewSet(viewsets.ModelViewSet):
    queryset = ProduccionLeche.objects.all()
    serializer_class = ProduccionLecheSerializer


class ConsumoViewSet(viewsets.ModelViewSet):
    queryset = Consumo.objects.all()
    serializer_class = ConsumoSerializer
    # Un consumo no se edita ni se borra: se anula (PATCH) y queda el registro.
    http_method_names = ["get", "post", "patch", "head", "options"]


class InventarioViewSet(viewsets.ModelViewSet):
    queryset = Inventario.objects.prefetch_related("detalles").all()
    serializer_class = InventarioSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]


class DetalleInventarioViewSet(viewsets.ModelViewSet):
    queryset = DetalleInventario.objects.all()
    serializer_class = DetalleInventarioSerializer
    http_method_names = ["get", "post", "head", "options"]


def _solo_rut(texto):
    return "".join(c for c in str(texto) if c.isalnum()).upper()


def _contrasena_correcta(usuario, ingresada):
    """Compara con el hash. Si la clave aún está en texto plano (usuarios antiguos),
    la acepta una vez y la deja guardada ya con hash."""
    guardada = usuario.contrasena or ""
    try:
        identify_hasher(guardada)
    except ValueError:
        if constant_time_compare(ingresada, guardada):
            usuario.contrasena = make_password(ingresada)
            usuario.save(update_fields=["contrasena"])
            return True
        return False
    return check_password(ingresada, guardada)


class LoginThrottle(AnonRateThrottle):
    scope = "login"


@api_view(["POST"])
@throttle_classes([LoginThrottle])
def login(request):
    """POST /api/auth/login/  {rut, contrasena} -> {usuario}"""
    rut = _solo_rut(request.data.get("rut", ""))
    contrasena = str(request.data.get("contrasena", ""))
    invalido = Response({"detail": "RUT o contraseña incorrectos."}, status=status.HTTP_400_BAD_REQUEST)
    if not rut or not contrasena:
        return invalido
    usuario = next((u for u in Usuario.objects.all() if _solo_rut(u.rut) == rut), None)
    if usuario is None or not _contrasena_correcta(usuario, contrasena):
        return invalido
    if not esta_activo(usuario):
        return Response({"detail": "Tu usuario está inactivo. Contacta al administrador."}, status=status.HTTP_403_FORBIDDEN)
    return Response({"usuario": UsuarioSerializer(usuario).data})
