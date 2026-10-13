import django_filters

from .models import Venta


class VentaFilter(django_filters.FilterSet):
    # Rango de fechas por día calendario (zona horaria del proyecto): ?desde=2026-10-01&hasta=2026-10-31
    desde = django_filters.DateFilter(field_name='fecha', lookup_expr='date__gte')
    hasta = django_filters.DateFilter(field_name='fecha', lookup_expr='date__lte')
    # Rango de monto: ?total_min=1000&total_max=5000
    total_min = django_filters.NumberFilter(field_name='total', lookup_expr='gte')
    total_max = django_filters.NumberFilter(field_name='total', lookup_expr='lte')

    class Meta:
        model = Venta
        # ?usuario=2&medio_pago=1&activa=false
        fields = ('usuario', 'medio_pago', 'activa')
