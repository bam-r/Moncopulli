from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProveedorViewSet,
    UsuarioViewSet,
    BodegaViewSet,
    ProductoViewSet,
    DetalleDocumentoViewSet,
    DocumentoCompraViewSet,
    ProduccionLecheViewSet,
    ConsumoViewSet,
    InventarioViewSet,
    DetalleInventarioViewSet    
)

router = DefaultRouter()
router.register(r'proveedores', ProveedorViewSet)
router.register(r'usuarios', UsuarioViewSet)
router.register(r'bodegas', BodegaViewSet)
router.register(r'productos', ProductoViewSet)
router.register(r'detalle-documentos', DetalleDocumentoViewSet)
router.register(r'documentos-compra', DocumentoCompraViewSet)
router.register(r'produccion-leche', ProduccionLecheViewSet)
router.register(r'consumos', ConsumoViewSet)
router.register(r'inventarios', InventarioViewSet)
router.register(r'detalle-inventarios', DetalleInventarioViewSet)

urlpatterns = [
    path('', include(router.urls)),
]