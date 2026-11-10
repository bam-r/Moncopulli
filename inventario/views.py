from rest_framework import viewsets
from django.contrib.auth.hashers import check_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from datetime import timedelta, timezone
from django.views.generic import TemplateView
from .models import Usuario
from .serializers import LoginSerializer
from .models import Consumo, DetalleDocumento, ProduccionLeche, Proveedor, Bodega, Producto, DocumentoCompra, Usuario, Inventario, DetalleInventario
from .serializers import (
    ConsumoSerializer, DetalleDocumentoSerializer, ProduccionLecheSerializer, ProveedorSerializer, BodegaSerializer, ProductoSerializer, DocumentoCompraSerializer, UsuarioSerializer, InventarioSerializer, DetalleInventarioSerializer
)

class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "datos inválidos"}, status=status.HTTP_400_BAD_REQUEST)
        
        rut = serializer.validated_data['rut']
        contrasena = serializer.validated_data['contrasena']

        try:
            usuario = Usuario.objects.get(rut=rut)
        except Usuario.DoesNotExist:
            return Response({"error": "datos inválidos"}, status=status.HTTP_400_BAD_REQUEST)


        if usuario.estado == 'bloqueado':
            if usuario.bloqueado_hasta and timezone.now() < usuario.bloqueado_hasta:
                return Response({
                    "error": "Cuenta bloqueada temporalmente por seguridad. Intente más tarde o contacte al administrador."
                }, status=status.HTTP_403_FORBIDDEN)
            else:
 
                usuario.estado = 'activo'
                usuario.intentos_fallidos = 0
                usuario.bloqueado_hasta = None
                usuario.save()

        if check_password(contrasena, usuario.contrasena):

            usuario.intentos_fallidos = 0
            usuario.save()

            menu_destino = "administrador" if usuario.rol.upper() == "ADMIN" else "trabajador"

            return Response({
                "mensaje": "Sesión iniciada con éxito",
                "rol": usuario.rol,
                "menu": menu_destino,
                "nombre": usuario.nombre_completo
            }, status=status.HTTP_200_OK)
        else:
            usuario.intentos_fallidos += 1
            
            if usuario.intentos_fallidos >= 5:
                usuario.estado = 'bloqueado'
                usuario.bloqueado_hasta = timezone.now() + timedelta(minutes=15)
                usuario.save()

                return Response({
                    "error": "Cuenta bloqueada temporalmente debido a 5 intentos fallidos consecutivos."
                }, status=status.HTTP_403_FORBIDDEN)
            
            usuario.save()
            return Response({"error": "datos inválidos"}, status=status.HTTP_400_BAD_REQUEST)

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
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer

class DetalleDocumentoViewSet(viewsets.ModelViewSet):
    queryset = DetalleDocumento.objects.all()
    serializer_class = DetalleDocumentoSerializer

class DocumentoCompraViewSet(viewsets.ModelViewSet):
    queryset = DocumentoCompra.objects.all()
    serializer_class = DocumentoCompraSerializer

class ProduccionLecheViewSet(viewsets.ModelViewSet):
    queryset = ProduccionLeche.objects.all()
    serializer_class = ProduccionLecheSerializer

class ConsumoViewSet(viewsets.ModelViewSet):
    queryset = Consumo.objects.all()
    serializer_class = ConsumoSerializer

class InventarioViewSet(viewsets.ModelViewSet):
    queryset = Inventario.objects.all()
    serializer_class = InventarioSerializer

class DetalleInventarioViewSet(viewsets.ModelViewSet):
    queryset = DetalleInventario.objects.all()
    serializer_class = DetalleInventarioSerializer



class LoginTemplateView(TemplateView):
    template_name = 'inventario/login.html'