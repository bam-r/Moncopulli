from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    LoginTemplateView,
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
    path('login/', LoginView.as_view(), name='login_api'),
    path('login-template/', LoginTemplateView.as_view(), name='login_template'),
    path('', include(router.urls)),
]