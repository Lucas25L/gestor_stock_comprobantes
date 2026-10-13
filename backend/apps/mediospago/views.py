from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from apps.usuarios.permissions import EsAdministrador, EsCajero, PermisosPorAccionMixin

from .models import MedioPago
from .serializers import MedioPagoSerializer


class MedioPagoViewSet(PermisosPorAccionMixin, viewsets.ModelViewSet):
    # Consultan quienes venden (Cajero) y quien administra; solo el Administrador modifica.
    permisos_por_accion = {
        'list': (EsAdministrador | EsCajero,),
        'retrieve': (EsAdministrador | EsCajero,),
    }
    serializer_class = MedioPagoSerializer
    filterset_fields = ('activo',)
    search_fields = ('nombre', 'descripcion')
    ordering_fields = ('nombre',)

    def get_queryset(self):
        queryset = MedioPago.objects.all()
        if self.request.query_params.get('incluir_inactivos') != 'true':
            queryset = queryset.filter(activo=True)
        return queryset

    def perform_destroy(self, instance):
        # Baja lógica: las ventas históricas conservan su medio de pago.
        instance.activo = False
        instance.save(update_fields=['activo'])

    @extend_schema(
        summary='Reactivar medio de pago',
        description='Revierte la baja lógica de un medio de pago desactivado.',
        request=None,
        responses=MedioPagoSerializer,
    )
    @action(detail=True, methods=('post',))
    def reactivar(self, request, pk=None):
        medio = get_object_or_404(MedioPago, pk=pk)
        medio.activo = True
        medio.save(update_fields=['activo'])
        return Response(self.get_serializer(medio).data)
