from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from apps.usuarios.permissions import CualquierRol, PermisosPorAccionMixin

from .models import UnidadMedida
from .serializers import UnidadMedidaSerializer


class UnidadMedidaViewSet(PermisosPorAccionMixin, viewsets.ModelViewSet):
    permisos_por_accion = {'list': (CualquierRol,), 'retrieve': (CualquierRol,)}
    serializer_class = UnidadMedidaSerializer

    def get_queryset(self):
        queryset = UnidadMedida.objects.all()
        if self.request.query_params.get('incluir_inactivas') != 'true':
            queryset = queryset.filter(activo=True)
        return queryset

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])

    @extend_schema(
        summary='Reactivar unidad de medida',
        description='Revierte la baja lógica de una unidad de medida desactivada.',
        request=None,
        responses=UnidadMedidaSerializer,
    )
    @action(detail=True, methods=('post',))
    def reactivar(self, request, pk=None):
        unidad = get_object_or_404(UnidadMedida, pk=pk)
        unidad.activo = True
        unidad.save(update_fields=['activo'])
        return Response(self.get_serializer(unidad).data)