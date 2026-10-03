from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Categoria
from .serializers import CategoriaSerializer


class CategoriaViewSet(viewsets.ModelViewSet): #Al heredar de ModelViewSet, DRF te da automáticamente los 5 endpoints CRUD estándar
    serializer_class = CategoriaSerializer
    filterset_fields = ('activa',)
    search_fields = ('nombre',)
    ordering_fields = ('nombre', 'creado_en')

    def get_queryset(self): # filtrado de inactivas
        queryset = Categoria.objects.all()
        if self.request.query_params.get('incluir_inactivas') != 'true':
            queryset = queryset.filter(activa=True)
        return queryset

    def perform_destroy(self, instance): # Sobrescribimos el método perform_destroy para implementar un soft-delete.
        instance.activa = False
        instance.save()
    
    @extend_schema( # documenta este endpoint específico en el Swagger/OpenAPI
        summary='Reactivar categoría',
        description='Revierte el soft-delete de una categoría desactivada, marcándola como activa nuevamente.',
        request=None,
        responses=CategoriaSerializer,
    )
    @action(detail=True, methods=('post',)) #Acción custom reactivar
    def reactivar(self, request, pk=None): # POST /categorias/{id}/reactivar/
        categoria = Categoria.objects.filter(pk=pk).first()
        if categoria is None:
            return Response({'detail': 'No encontrado.'}, status=404)

        categoria.activa = True
        categoria.save()
        return Response(self.get_serializer(categoria).data)