from django.db.models import F
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import ProductoFilter
from .models import Producto
from .serializers import ProductoSerializer

from apps.usuarios.permissions import CualquierRol, PermisosPorAccionMixin


class ProductoViewSet(PermisosPorAccionMixin, viewsets.ModelViewSet):
    permisos_por_accion = {
        'list': (CualquierRol,),
        'retrieve': (CualquierRol,),
        'stock_bajo': (CualquierRol,),
    }
    serializer_class = ProductoSerializer
    filterset_class = ProductoFilter
    search_fields = ('nombre', 'descripcion', 'codigo_barras', 'categoria__nombre')
    ordering_fields = ('nombre', 'precio', 'stock', 'stock_minimo', 'creado_en', 'actualizado_en')

    def get_queryset(self):
        queryset = Producto.objects.select_related('categoria').all()
        if self.request.query_params.get('incluir_inactivos') != 'true':
            queryset = queryset.filter(activo=True)
        return queryset

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save()

    @extend_schema(
        summary='Productos con stock bajo',
        description=(
            'Lista de reposición: productos activos con stock menor o igual al stock mínimo, '
            'ordenados de mayor a menor faltante. Acepta los mismos filtros, búsqueda y '
            'ordenamiento que el listado de productos.'
        ),
        responses=ProductoSerializer(many=True),
    )
    @action(detail=False, methods=('get',), url_path='stock-bajo')
    def stock_bajo(self, request):
        base = (
            self.get_queryset()
            .filter(activo=True, stock__lte=F('stock_minimo'))
            .annotate(faltante_calculado=F('stock_minimo') - F('stock'))
            .order_by('-faltante_calculado', 'nombre')
        )
        # Si el pedido trae ?ordering=..., ese orden reemplaza al de criticidad.
        queryset = self.filter_queryset(base)
        return Response(self.get_serializer(queryset, many=True).data)

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