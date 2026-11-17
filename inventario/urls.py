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
    DetalleInventarioViewSet,
    StockBodegaViewSet,
    login,
    usuario_actual,
    logout,
    exportar_datos,
    actualizar_perfil,
    cambiar_contrasena,
    preferencias_privacidad,
    anonimizar_cuenta,
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
router.register(r'stock-bodega', StockBodegaViewSet, basename='stock-bodega')

urlpatterns = [
    path('auth/login/', login),
    path('auth/me/', usuario_actual),
    path('auth/logout/', logout),
    path('user/data-export/', exportar_datos),
    path('user/profile/', actualizar_perfil),
    path('user/password/', cambiar_contrasena),
    path('user/preferences/', preferencias_privacidad),
    path('user/account/', anonimizar_cuenta),
    path('', include(router.urls)),
]