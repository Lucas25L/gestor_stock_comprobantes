from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.auditoria.models import Auditoria
from apps.auditoria.services import registrar
from apps.usuarios.permissions import EsAdministrador, EsRepositor

from . import services
from .filters import MovimientoStockFilter
from .models import MovimientoStock
from .serializers import (
    AjusteStockSerializer,
    IngresoStockSerializer,
    MovimientoStockSerializer,
)

PERMISOS_STOCK = (EsAdministrador | EsRepositor,)


class PaginacionMovimientos(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


def _detalle(movimiento):
    # JSONField no serializa Decimal: se guardan como texto con 3 decimales.
    return {
        'producto': movimiento.producto.nombre,
        'cantidad': f'{movimiento.cantidad:.3f}',
        'stock_resultante': f'{movimiento.stock_resultante:.3f}',
        'motivo': movimiento.motivo,
        'movimiento_id': movimiento.pk,
    }


class _CrearMovimientoViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = PERMISOS_STOCK
    accion_auditoria = None

    def _aplicar(self, usuario, datos):
        raise NotImplementedError

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            # Movimiento y auditoría se confirman juntos o no se confirma ninguno.
            with transaction.atomic():
                movimiento = self._aplicar(request.user, serializer.validated_data)
                registrar(
                    usuario=request.user,
                    accion=self.accion_auditoria,
                    entidad='Producto',
                    id_registro=movimiento.producto_id,
                    detalle=_detalle(movimiento),
                )
        except services.StockError as error:
            raise ValidationError({'detail': str(error)})
        return Response(MovimientoStockSerializer(movimiento).data, status=status.HTTP_201_CREATED)


class IngresoStockViewSet(_CrearMovimientoViewSet):
    serializer_class = IngresoStockSerializer
    accion_auditoria = Auditoria.Accion.INGRESO_STOCK

    def _aplicar(self, usuario, datos):
        return services.registrar_ingreso(
            usuario=usuario, producto=datos['producto'], cantidad=datos['cantidad'],
            motivo=datos['motivo'], referencia=datos.get('referencia', ''),
        )


class AjusteStockViewSet(_CrearMovimientoViewSet):
    serializer_class = AjusteStockSerializer
    accion_auditoria = Auditoria.Accion.AJUSTE_STOCK

    def _aplicar(self, usuario, datos):
        return services.registrar_ajuste(
            usuario=usuario, producto=datos['producto'], cantidad=datos['cantidad'],
            motivo=datos['motivo'],
        )


class MovimientoStockViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = PERMISOS_STOCK
    serializer_class = MovimientoStockSerializer
    pagination_class = PaginacionMovimientos
    queryset = MovimientoStock.objects.select_related('producto', 'usuario')
    filterset_class = MovimientoStockFilter
    search_fields = ('producto__nombre', 'motivo', 'referencia_origen')
    ordering_fields = ('fecha_hora', 'cantidad', 'stock_resultante')
