from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Producto
from .serializers import ProductoSerializer


class ProductoViewSet(viewsets.ModelViewSet):
    serializer_class = ProductoSerializer
    filterset_fields = ('categoria', 'activo')
    search_fields = ('nombre', 'codigo_barras')
    ordering_fields = ('nombre', 'precio', 'stock', 'creado_en')

    def get_queryset(self):
        queryset = Producto.objects.select_related('categoria').all()
        if self.request.query_params.get('incluir_inactivos') != 'true':
            queryset = queryset.filter(activo=True)
        return queryset

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save()

    @extend_schema(
        summary='Reactivar producto',
        description='Revierte el soft-delete de un producto desactivado, marcándolo como activo nuevamente.',
        request=None,
        responses=ProductoSerializer,
    )
    @action(detail=True, methods=('post',))
    def reactivar(self, request, pk=None):
        producto = Producto.objects.filter(pk=pk).first()
        if producto is None:
            return Response({'detail': 'No encontrado.'}, status=404)

        producto.activo = True
        producto.save()
        return Response(self.get_serializer(producto).data)