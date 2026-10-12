from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from rest_framework import serializers

from apps.auditoria.models import Auditoria
from apps.auditoria.services import registrar
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.stock import services as stock_services

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
    # Incluye productos desactivados: RN-10 permite venderlos mientras tengan stock.
    producto = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.select_related('unidad')
    )
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal('0.001'))


class VentaSerializer(serializers.ModelSerializer):
    medio_pago = serializers.PrimaryKeyRelatedField(queryset=MedioPago.objects.filter(activo=True))
    medio_pago_nombre = serializers.CharField(source='medio_pago.nombre', read_only=True)
    estado = serializers.SerializerMethodField()
    anulada_por_username = serializers.CharField(source='anulada_por.username', read_only=True, default=None)
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    items = DetalleVentaInputSerializer(many=True, write_only=True)

    class Meta:
        model = Venta
        fields = (
            'id', 'usuario', 'medio_pago', 'medio_pago_nombre', 'fecha', 'total',
            'impuestos_nacionales', 'activa', 'estado', 'motivo_anulacion', 'anulada_por',
            'anulada_por_username', 'fecha_anulacion', 'detalles', 'items',
        )
        read_only_fields = (
            'id', 'usuario', 'fecha', 'total', 'impuestos_nacionales', 'activa',
            'motivo_anulacion', 'anulada_por', 'fecha_anulacion',
        )

    def get_estado(self, venta) -> str:
        return venta.estado

    def validate_items(self, items):
        """Controles previos para dar errores claros. La verificación definitiva
        del stock la hace el servicio de stock, con el producto bloqueado."""
        if not items:
            raise serializers.ValidationError('La venta debe tener al menos un producto.')

        for item in items:
            producto = item['producto']
            if not producto.unidad.admite_cantidad(item['cantidad']):
                raise serializers.ValidationError(
                    f'"{producto.nombre}" se vende por {producto.unidad.nombre.lower()} '
                    f'y solo admite cantidades enteras.'
                )
            if producto.stock < item['cantidad']:
                if not producto.activo:
                    raise serializers.ValidationError(
                        f'"{producto.nombre}" está desactivado y solo puede venderse hasta '
                        f'agotar su stock. Disponible: {producto.stock}.'
                    )
                raise serializers.ValidationError(
                    f'Stock insuficiente para "{producto.nombre}". '
                    f'Disponible: {producto.stock}, solicitado: {item["cantidad"]}.'
                )
        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop('items')
        medio_pago = validated_data['medio_pago']
        usuario = self.context['request'].user

        # Bloqueamos los productos (en orden de id) antes de leer precio y stock:
        # el precio que se cobra es el vigente en el momento de confirmar (RN-20).
        ids = sorted({item['producto'].pk for item in items})
        productos = {
            producto.pk: producto
            for producto in Producto.objects.select_for_update(of=('self',))
            .select_related('unidad')
            .filter(pk__in=ids)
            .order_by('pk')
        }

        total = Decimal(0)
        detalles_a_crear = []
        for item in items:
            producto = productos[item['producto'].pk]
            cantidad = item['cantidad']
            precio_unitario = producto.precio
            subtotal_item = (precio_unitario * cantidad).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            total += subtotal_item
            detalles_a_crear.append({
                'producto': producto,
                'cantidad': cantidad,
                'precio_unitario': precio_unitario,
                'subtotal': subtotal_item,
            })

        impuestos_nacionales = total - (total / Decimal('1.21'))

        venta = Venta.objects.create(
            usuario=usuario,
            medio_pago=medio_pago,
            total=total,
            impuestos_nacionales=impuestos_nacionales.quantize(Decimal('0.01')),
        )
        for detalle in detalles_a_crear:
            DetalleVenta.objects.create(venta=venta, **detalle)

        # Descuento de stock con bloqueo; deja un movimiento por producto. Si el stock
        # no alcanza, se lanza el error y la transacción deshace la venta completa.
        try:
            stock_services.descontar_por_venta(
                usuario=usuario,
                lineas=[(d['producto'], d['cantidad']) for d in detalles_a_crear],
                referencia=f'venta:{venta.pk}',
            )
        except stock_services.StockError as error:
            raise serializers.ValidationError({'items': [str(error)]})

        registrar(
            usuario=usuario,
            accion=Auditoria.Accion.VENTA_REGISTRADA,
            entidad='Venta',
            id_registro=venta.pk,
            detalle={
                'total': f'{total:.2f}',
                'medio_pago': medio_pago.nombre,
                'cantidad_de_lineas': len(detalles_a_crear),
            },
        )
        return venta


class AnularVentaSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError('El motivo de la anulación es obligatorio.')
        return valor
