from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from apps.stock.services import StockError
from apps.usuarios.permissions import EsAdministrador, EsCajero

from . import services
from .models import Venta
from .serializers import AnularVentaSerializer, VentaSerializer


class VentaViewSet(viewsets.ModelViewSet):
    permission_classes = (EsAdministrador | EsCajero,)
    # Las ventas no se borran: se anulan con POST /api/ventas/{id}/anular/.
    http_method_names = ('get', 'post', 'head', 'options')
    serializer_class = VentaSerializer
    filterset_fields = ('usuario', 'activa')
    ordering_fields = ('fecha', 'total')

    def get_queryset(self):
        queryset = (
            Venta.objects.select_related('usuario', 'medio_pago', 'anulada_por')
            .prefetch_related('detalles__producto')
            .all()
        )
        # El listado oculta las anuladas salvo que se pidan; el detalle siempre las muestra.
        if self.action == 'list' and self.request.query_params.get('incluir_inactivas') != 'true':
            queryset = queryset.filter(activa=True)
        return queryset

    @extend_schema(
        summary='Crear una venta',
        description=(
            'Crea una venta a partir de una lista de productos y cantidades. '
            'El stock se bloquea, valida y descuenta de forma atómica. El total y los '
            'impuestos nacionales se calculan en el backend (no se reciben del cliente).'
        ),
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        summary='Anular una venta',
        description=(
            'Anula la venta (se conserva en el historial como anulada), repone el stock de '
            'los productos vendidos y registra usuario, fecha y motivo. El motivo es obligatorio.'
        ),
        request=AnularVentaSerializer,
        responses=VentaSerializer,
    )
    @action(detail=True, methods=('post',))
    def anular(self, request, pk=None):
        get_object_or_404(Venta, pk=pk)  # 404 si no existe
        serializer = AnularVentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            venta = services.anular_venta(
                usuario=request.user, venta_id=pk, motivo=serializer.validated_data['motivo']
            )
        except (services.VentaError, StockError) as error:
            raise ValidationError({'detail': str(error)})
        venta = self.get_queryset().get(pk=venta.pk)
        return Response(self.get_serializer(venta).data)
