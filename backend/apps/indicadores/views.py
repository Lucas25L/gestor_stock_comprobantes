from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.usuarios.permissions import EsAdministrador

from . import services
from .serializers import (
    CategoriaMasVendidaSerializer,
    MedioPagoIndicadorSerializer,
    ParametrosPeriodoSerializer,
    ParametrosProductosSerializer,
    ParametrosRankingSerializer,
    ProductoMasVendidoSerializer,
    ResumenSerializer,
)


class IndicadoresViewSet(viewsets.ViewSet):
    """Indicadores de ventas (RF-43 a RF-46). Solo el Administrador; excluyen ventas anuladas."""

    permission_classes = (EsAdministrador,)

    @staticmethod
    def _parametros(clase, request):
        serializer = clase(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    @extend_schema(
        summary='Resumen de ventas por período',
        parameters=[ParametrosPeriodoSerializer],
        responses=ResumenSerializer,
    )
    @action(detail=False, methods=('get',))
    def resumen(self, request):
        datos = self._parametros(ParametrosPeriodoSerializer, request)
        return Response(ResumenSerializer(services.resumen(**datos)).data)

    @extend_schema(
        summary='Ventas agrupadas por medio de pago',
        parameters=[ParametrosPeriodoSerializer],
        responses=MedioPagoIndicadorSerializer(many=True),
    )
    @action(detail=False, methods=('get',), url_path='por-medio-pago')
    def por_medio_pago(self, request):
        datos = self._parametros(ParametrosPeriodoSerializer, request)
        filas = services.por_medio_pago(**datos)
        return Response(MedioPagoIndicadorSerializer(filas, many=True).data)

    @extend_schema(
        summary='Productos más vendidos',
        description=(
            'Ordena por cantidad vendida, expresada en la unidad de cada producto. '
            'Use `unidad` para comparar solo productos de la misma unidad.'
        ),
        parameters=[ParametrosProductosSerializer],
        responses=ProductoMasVendidoSerializer(many=True),
    )
    @action(detail=False, methods=('get',), url_path='productos-mas-vendidos')
    def productos_mas_vendidos(self, request):
        datos = self._parametros(ParametrosProductosSerializer, request)
        filas = services.productos_mas_vendidos(**datos)
        return Response(ProductoMasVendidoSerializer(filas, many=True).data)

    @extend_schema(
        summary='Categorías más vendidas',
        description='Importe vendido por categoría actual del producto.',
        parameters=[ParametrosRankingSerializer],
        responses=CategoriaMasVendidaSerializer(many=True),
    )
    @action(detail=False, methods=('get',), url_path='categorias-mas-vendidas')
    def categorias_mas_vendidas(self, request):
        datos = self._parametros(ParametrosRankingSerializer, request)
        filas = services.categorias_mas_vendidas(**datos)
        return Response(CategoriaMasVendidaSerializer(filas, many=True).data)
