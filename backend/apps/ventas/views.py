from drf_spectacular.utils import extend_schema
from rest_framework import viewsets

from .models import Venta
from .serializers import VentaSerializer

from apps.usuarios.permissions import EsAdministrador, EsCajero


class VentaViewSet(viewsets.ModelViewSet):
    permission_classes = (EsAdministrador | EsCajero,)
    http_method_names = ('get', 'post', 'delete', 'head', 'options')
    serializer_class = VentaSerializer
    filterset_fields = ('usuario', 'activa')
    ordering_fields = ('fecha', 'total')

    def get_queryset(self):
        queryset = Venta.objects.select_related('usuario').prefetch_related('detalles__producto').all()
        if self.request.query_params.get('incluir_inactivas') != 'true':
            queryset = queryset.filter(activa=True)
        return queryset

    @extend_schema(
        summary='Crear una venta',
        description=(
            'Crea una venta a partir de una lista de productos y cantidades. '
            'El stock se valida y descuenta automáticamente. El total y los '
            'impuestos nacionales se calculan en el backend (no se reciben del cliente).'
        ),
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        summary='Anular una venta',
        description='Anula la venta (soft-delete) y repone automáticamente el stock de los productos vendidos.',
    )
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)