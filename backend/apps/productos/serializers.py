from rest_framework import serializers

from apps.unidades.models import UnidadMedida

from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    unidad = serializers.PrimaryKeyRelatedField(queryset=UnidadMedida.objects.filter(activo=True))
    unidad_nombre = serializers.CharField(source='unidad.nombre', read_only=True)
    unidad_abreviatura = serializers.CharField(source='unidad.abreviatura', read_only=True)
    unidad_permite_decimales = serializers.BooleanField(
        source='unidad.permite_decimales', read_only=True
    )

    class Meta:
        model = Producto
        fields = (
            'id', 'nombre', 'descripcion', 'precio', 'stock', 'stock_minimo',
            'codigo_barras', 'categoria', 'categoria_nombre', 'unidad',
            'unidad_nombre', 'unidad_abreviatura', 'unidad_permite_decimales',
            'activo', 'creado_en', 'actualizado_en',
        )
        # El stock solo cambia mediante movimientos (ingresos, ajustes, ventas).
        read_only_fields = ('id', 'stock', 'creado_en', 'actualizado_en')
        extra_kwargs = {
            'stock_minimo': {'min_value': 0},
        }

    def validate(self, attrs):
        unidad = attrs.get('unidad', getattr(self.instance, 'unidad', None))
        for campo in ('stock', 'stock_minimo'):  # el stock vigente se revalida al cambiar de unidad
            if campo in attrs:
                valor = attrs[campo]
            elif self.instance is not None:
                valor = getattr(self.instance, campo)
            else:
                continue
            if unidad is not None and not unidad.admite_cantidad(valor):
                raise serializers.ValidationError(
                    {campo: f'La unidad "{unidad.nombre}" solo admite cantidades enteras.'}
                )
        return attrs
