from rest_framework import viewsets
from .models import Consumo, DetalleDocumento, ProduccionLeche, Proveedor, Bodega, Producto, DocumentoCompra, Usuario, Inventario, DetalleInventario
from .serializers import (
    ConsumoSerializer, DetalleDocumentoSerializer, ProduccionLecheSerializer, ProveedorSerializer, BodegaSerializer, ProductoSerializer, DocumentoCompraSerializer, UsuarioSerializer, InventarioSerializer, DetalleInventarioSerializer
)

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