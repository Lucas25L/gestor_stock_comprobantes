import django_filters

from .models import Producto


class ProductoFilter(django_filters.FilterSet):
    # Rangos de precio y de stock: ?precio_min=100&precio_max=500
    precio_min = django_filters.NumberFilter(field_name='precio', lookup_expr='gte')
    precio_max = django_filters.NumberFilter(field_name='precio', lookup_expr='lte')
    stock_min = django_filters.NumberFilter(field_name='stock', lookup_expr='gte')
    stock_max = django_filters.NumberFilter(field_name='stock', lookup_expr='lte')

    class Meta:
        model = Producto
        # Filtros de igualdad: ?categoria=3&unidad=1&activo=true
        fields = ('categoria', 'unidad', 'activo')
