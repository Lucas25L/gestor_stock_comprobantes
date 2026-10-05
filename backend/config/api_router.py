from rest_framework.routers import DefaultRouter

from apps.categorias.views import CategoriaViewSet
from apps.comprobantes.views import ComprobanteViewSet
from apps.productos.views import ProductoViewSet
from apps.ventas.views import VentaViewSet

from apps.usuarios.views import RolViewSet, UsuarioViewSet

from apps.auditoria.views import AuditoriaViewSet

router = DefaultRouter()
router.register('categorias', CategoriaViewSet, basename='categoria')
router.register('productos', ProductoViewSet, basename='producto')
router.register('ventas', VentaViewSet, basename='venta')
router.register('roles', RolViewSet, basename='rol')
router.register('usuarios', UsuarioViewSet, basename='usuario')
router.register('comprobantes', ComprobanteViewSet, basename='comprobante')

router.register('auditoria', AuditoriaViewSet, basename='auditoria')

urlpatterns = router.urls