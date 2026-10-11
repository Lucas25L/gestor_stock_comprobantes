from rest_framework.routers import DefaultRouter

from apps.categorias.views import CategoriaViewSet
from apps.comprobantes.views import ComprobanteViewSet
from apps.productos.views import ProductoViewSet
from apps.auditoria.views import AuditoriaViewSet
from apps.stock.views import AjusteStockViewSet, IngresoStockViewSet, MovimientoStockViewSet
from apps.unidades.views import UnidadMedidaViewSet
from apps.usuarios.views import RolViewSet, UsuarioViewSet
from apps.ventas.views import VentaViewSet

router = DefaultRouter()
router.register('categorias', CategoriaViewSet, basename='categoria')
router.register('productos', ProductoViewSet, basename='producto')
router.register('usuarios', UsuarioViewSet, basename='usuario')
router.register('auditoria', AuditoriaViewSet, basename='auditoria')
router.register('unidades', UnidadMedidaViewSet, basename='unidad')
router.register('stock/ingresos', IngresoStockViewSet, basename='stock-ingreso')
router.register('stock/ajustes', AjusteStockViewSet, basename='stock-ajuste')
router.register('stock/movimientos', MovimientoStockViewSet, basename='stock-movimiento')
router.register('roles', RolViewSet, basename='rol')
router.register('ventas', VentaViewSet, basename='venta')
router.register('comprobantes', ComprobanteViewSet, basename='comprobante')

urlpatterns = router.urls
