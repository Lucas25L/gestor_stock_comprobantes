from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.usuarios.permissions import EsAdministrador, EsCajero

from . import services
from .filters import ComprobanteFilter
from .models import Comprobante
from .serializers import ComprobanteSerializer


class ComprobanteViewSet(viewsets.ModelViewSet):
    permission_classes = (EsAdministrador | EsCajero,)
    # Un comprobante no se modifica ni se borra: solo se emite y se consulta.
    http_method_names = ('get', 'post', 'head', 'options')
    serializer_class = ComprobanteSerializer
    queryset = Comprobante.objects.select_related('venta')
    filterset_class = ComprobanteFilter
    ordering_fields = ('fecha_emision', 'numero')

    @extend_schema(
        summary='Emitir un comprobante',
        description=(
            'Emite el comprobante interno de una venta confirmada, con numeración '
            'correlativa y sin duplicados. Guarda una copia de los datos de la venta. '
            'Falla con 400 si la venta ya tiene comprobante o si está anulada.'
        ),
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            comprobante = services.emitir_comprobante(
                usuario=request.user, venta_id=serializer.validated_data['venta'].pk
            )
        except services.ComprobanteError as error:
            raise ValidationError({'venta': str(error)})
        return Response(self.get_serializer(comprobante).data, status=status.HTTP_201_CREATED)
