from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from apps.usuarios.permissions import EsAdministrador

from .filters import AuditoriaFilter
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
    filterset_class = AuditoriaFilter
    search_fields = ('entidad', 'accion')
    ordering_fields = ('fecha_hora', 'accion', 'entidad')
