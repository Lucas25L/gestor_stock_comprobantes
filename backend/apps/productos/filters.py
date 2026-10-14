import django_filters
from django.db.models import F, Q

from .models import Producto


class ProductoFilter(django_filters.FilterSet):
    # Rangos de precio y de stock: ?precio_min=100&precio_max=500
    precio_min = django_filters.NumberFilter(field_name='precio', lookup_expr='gte')
    precio_max = django_filters.NumberFilter(field_name='precio', lookup_expr='lte')
    stock_min = django_filters.NumberFilter(field_name='stock', lookup_expr='gte')
    stock_max = django_filters.NumberFilter(field_name='stock', lookup_expr='lte')
    # Reposición (RF-11): ?stock_bajo=true -> activos con stock <= stock_minimo.
    stock_bajo = django_filters.BooleanFilter(method='filtrar_stock_bajo')

    class Meta:
        model = Producto
        # Filtros de igualdad: ?categoria=3&unidad=1&activo=true
        fields = ('categoria', 'unidad', 'activo')

    def filtrar_stock_bajo(self, queryset, name, value):
        if value is None:
            return queryset
        stock_bajo = Q(activo=True, stock__lte=F('stock_minimo'))
        return queryset.filter(stock_bajo) if value else queryset.exclude(stock_bajo)
