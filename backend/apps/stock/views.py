from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.auditoria.models import Auditoria
from apps.auditoria.services import registrar
from apps.usuarios.permissions import EsAdministrador, EsRepositor

from . import services
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

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        for parametro, campo in (('producto', 'producto_id'), ('usuario', 'usuario_id')):
            valor = params.get(parametro)
            if valor:
                if not valor.isdigit():
                    raise ValidationError({parametro: 'Debe ser un número entero.'})
                queryset = queryset.filter(**{campo: int(valor)})

        tipo = params.get('tipo')
        if tipo:
            if tipo not in MovimientoStock.Tipo.values:
                raise ValidationError(
                    {'tipo': f'Valores válidos: {", ".join(MovimientoStock.Tipo.values)}.'}
                )
            queryset = queryset.filter(tipo=tipo)

        referencia = params.get('referencia')
        if referencia:
            queryset = queryset.filter(referencia_origen=referencia)

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
