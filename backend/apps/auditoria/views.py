from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination

from apps.usuarios.permissions import EsAdministrador

from .models import Auditoria
from .serializers import AuditoriaSerializer


class PaginacionAuditoria(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class AuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (EsAdministrador,)
    serializer_class = AuditoriaSerializer
    pagination_class = PaginacionAuditoria
    queryset = Auditoria.objects.select_related('usuario')

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        for parametro in ('entidad', 'accion'):
            valor = params.get(parametro)
            if valor:
                queryset = queryset.filter(**{parametro: valor})

        for parametro, campo in (('usuario', 'usuario_id'), ('registro', 'id_registro_afectado')):
            valor = params.get(parametro)
            if valor:
                if not valor.isdigit():
                    raise ValidationError({parametro: 'Debe ser un número entero.'})
                queryset = queryset.filter(**{campo: int(valor)})

        for parametro, filtro in (('desde', 'fecha_hora__date__gte'), ('hasta', 'fecha_hora__date__lte')):
            valor = params.get(parametro)
            if valor:
                try:
                    fecha = parse_date(valor)
                except ValueError:
                    fecha = None
                if fecha is None:
                    raise ValidationError({parametro: 'Use el formato AAAA-MM-DD.'})
                queryset = queryset.filter(**{filtro: fecha})

        return queryset