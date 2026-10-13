import django_filters

from .models import Comprobante


class ComprobanteFilter(django_filters.FilterSet):
    # Se conserva el parámetro ?venta=ID que ya usa el frontend.
    venta = django_filters.NumberFilter(field_name='venta_id')
    # El campo `estado` del modelo no declara choices, por eso se declara acá.
    estado = django_filters.ChoiceFilter(choices=Comprobante.Estado.choices)
    medio_pago = django_filters.NumberFilter(field_name='venta__medio_pago_id')
    numero_desde = django_filters.NumberFilter(field_name='numero', lookup_expr='gte')
    numero_hasta = django_filters.NumberFilter(field_name='numero', lookup_expr='lte')
    desde = django_filters.DateFilter(field_name='fecha_emision', lookup_expr='date__gte')
    hasta = django_filters.DateFilter(field_name='fecha_emision', lookup_expr='date__lte')

    class Meta:
        model = Comprobante
        fields = ('numero',)
