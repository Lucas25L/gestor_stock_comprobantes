from rest_framework import serializers

from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)

    class Meta:
        model = Producto
        fields = (
            'id', 'nombre', 'descripcion', 'precio', 'stock', 'stock_minimo',
            'codigo_barras', 'categoria', 'categoria_nombre', 'activo',
            'creado_en', 'actualizado_en',
        )
        read_only_fields = ('id', 'creado_en', 'actualizado_en')