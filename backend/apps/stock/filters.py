import django_filters

from .models import MovimientoStock


class MovimientoStockFilter(django_filters.FilterSet):
    producto = django_filters.NumberFilter(field_name='producto_id')
    usuario = django_filters.NumberFilter(field_name='usuario_id')
    tipo = django_filters.ChoiceFilter(choices=MovimientoStock.Tipo.choices)
    referencia = django_filters.CharFilter(field_name='referencia_origen')
    desde = django_filters.DateFilter(field_name='fecha_hora', lookup_expr='date__gte')
    hasta = django_filters.DateFilter(field_name='fecha_hora', lookup_expr='date__lte')

    class Meta:
        model = MovimientoStock
        fields = ()
