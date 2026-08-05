from rest_framework.routers import DefaultRouter

from apps.categorias.views import CategoriaViewSet
from apps.comprobantes.views import ComprobanteViewSet
from apps.productos.views import ProductoViewSet
from apps.ventas.views import VentaViewSet

router = DefaultRouter()
router.register('categorias', CategoriaViewSet, basename='categoria')
router.register('productos', ProductoViewSet, basename='producto')
router.register('ventas', VentaViewSet, basename='venta')
router.register('comprobantes', ComprobanteViewSet, basename='comprobante')

urlpatterns = router.urls