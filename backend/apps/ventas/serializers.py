from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.productos.models import Producto

from .models import DetalleVenta, Venta


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = DetalleVenta
        fields = (
            'id', 'producto', 'producto_nombre', 'cantidad',
            'precio_unitario', 'subtotal',
        )
        read_only_fields = ('id', 'precio_unitario', 'subtotal')


class DetalleVentaInputSerializer(serializers.Serializer):
    """Serializer de solo entrada: lo que el frontend manda al crear una venta."""
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.filter(activo=True))
    cantidad = serializers.IntegerField(min_value=1)


class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    items = DetalleVentaInputSerializer(many=True, write_only=True)

    class Meta:
        model = Venta
        fields = (
            'id', 'usuario', 'fecha', 'total', 'impuestos_nacionales',
            'activa', 'detalles', 'items',
        )
        read_only_fields = ('id', 'usuario', 'fecha', 'total', 'impuestos_nacionales', 'activa')

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('La venta debe tener al menos un producto.')

        for item in items:
            producto = item['producto']
            if producto.stock < item['cantidad']:
                raise serializers.ValidationError(
                    f'Stock insuficiente para "{producto.nombre}". '
                    f'Disponible: {producto.stock}, solicitado: {item["cantidad"]}.'
                )
        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop('items')
        usuario = self.context['request'].user

        total = Decimal(0)
        detalles_a_crear = []

        for item in items:
            producto = item['producto']
            cantidad = item['cantidad']
            precio_unitario = producto.precio
            subtotal_item = precio_unitario * cantidad
            total += subtotal_item

            detalles_a_crear.append({
                'producto': producto,
                'cantidad': cantidad,
                'precio_unitario': precio_unitario,
                'subtotal': subtotal_item,
            })

            # Descuento automático de stock
            producto.stock -= cantidad
            producto.save(update_fields=['stock'])

        impuestos_nacionales = total - (total / Decimal('1.21'))

        venta = Venta.objects.create(
            usuario=usuario,
            total=total,
            impuestos_nacionales=impuestos_nacionales.quantize(Decimal('0.01')),
        )

        for detalle in detalles_a_crear:
            DetalleVenta.objects.create(venta=venta, **detalle)

        return venta