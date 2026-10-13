import django_filters

from .models import Auditoria


class AuditoriaFilter(django_filters.FilterSet):
    entidad = django_filters.CharFilter(field_name='entidad')
    accion = django_filters.CharFilter(field_name='accion')
    usuario = django_filters.NumberFilter(field_name='usuario_id')
    registro = django_filters.NumberFilter(field_name='id_registro_afectado')
    desde = django_filters.DateFilter(field_name='fecha_hora', lookup_expr='date__gte')
    hasta = django_filters.DateFilter(field_name='fecha_hora', lookup_expr='date__lte')

    class Meta:
        model = Auditoria
        fields = ()
