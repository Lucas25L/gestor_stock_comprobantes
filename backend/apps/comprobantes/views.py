from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets

from .models import Comprobante
from .serializers import ComprobanteSerializer

from apps.usuarios.permissions import EsAdministrador, EsCajero


class ComprobanteViewSet(viewsets.ModelViewSet):
    permission_classes = (EsAdministrador | EsCajero,)
    http_method_names = ('get', 'post', 'head', 'options')
    
    queryset = Comprobante.objects.select_related('venta').all()
    serializer_class = ComprobanteSerializer
    filterset_fields = ('venta',)
    ordering_fields = ('fecha_emision', 'numero')

    @extend_schema(
        summary='Emitir un comprobante',
        description=(
            'Emite un comprobante para una venta ya confirmada, con numeración '
            'correlativa automática. Falla con 400 si la venta ya tiene un '
            'comprobante emitido, o si la venta está anulada.'
        ),
    )

    def perform_create(self, serializer):
        venta = serializer.validated_data['venta']

        if hasattr(venta, 'comprobante'):
            raise serializers.ValidationError(
                {'venta': f'La venta #{venta.id} ya tiene un comprobante emitido.'}
            )

        if not venta.activa:
            raise serializers.ValidationError(
                {'venta': f'La venta #{venta.id} está anulada, no se puede emitir un comprobante.'}
            )

        serializer.save()