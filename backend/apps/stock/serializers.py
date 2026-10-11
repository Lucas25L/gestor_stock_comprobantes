from decimal import Decimal

from rest_framework import serializers

from apps.productos.models import Producto

from .models import MovimientoStock


class MovimientoStockSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = MovimientoStock
        fields = (
            'id', 'producto', 'producto_nombre', 'usuario', 'usuario_username',
            'tipo', 'tipo_display', 'cantidad', 'stock_resultante', 'motivo',
            'referencia_origen', 'fecha_hora',
        )
        read_only_fields = fields


class _BaseMovimientoSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError('El motivo es obligatorio.')
        return valor


class IngresoStockSerializer(_BaseMovimientoSerializer):
    cantidad = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal('0.001')
    )
    referencia = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')


class AjusteStockSerializer(_BaseMovimientoSerializer):
    # Con signo: positiva suma, negativa resta.
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3)

    def validate_cantidad(self, valor):
        if valor == 0:
            raise serializers.ValidationError('La cantidad no puede ser cero.')
        return valor
