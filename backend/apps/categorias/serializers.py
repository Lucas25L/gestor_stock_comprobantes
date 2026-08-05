from rest_framework import serializers

from .models import Categoria


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ('id', 'nombre', 'descripcion', 'activa', 'creado_en', 'actualizado_en')
        read_only_fields = ('id', 'creado_en', 'actualizado_en')