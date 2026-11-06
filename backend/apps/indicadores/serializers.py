from rest_framework import serializers

from apps.unidades.models import UnidadMedida

from .services import LIMITE_MAXIMO, LIMITE_POR_DEFECTO


class ParametrosPeriodoSerializer(serializers.Serializer):
    """Período del indicador, por día calendario. Ambos extremos son opcionales."""

    desde = serializers.DateField(required=False, help_text='Primer día incluido (AAAA-MM-DD).')
    hasta = serializers.DateField(required=False, help_text='Último día incluido (AAAA-MM-DD).')

    def validate(self, datos):
        desde, hasta = datos.get('desde'), datos.get('hasta')
        if desde and hasta and desde > hasta:
            raise serializers.ValidationError(
                {'hasta': 'La fecha final no puede ser anterior a la inicial.'}
            )
        return datos


class ParametrosRankingSerializer(ParametrosPeriodoSerializer):
    limite = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=LIMITE_MAXIMO,
        default=LIMITE_POR_DEFECTO,
        help_text='Cantidad máxima de filas del ranking.',
    )


class ParametrosProductosSerializer(ParametrosRankingSerializer):
    unidad = serializers.PrimaryKeyRelatedField(
        queryset=UnidadMedida.objects.all(),
        required=False,
        help_text='Rankea solo los productos de esa unidad de medida.',
    )


class ResumenSerializer(serializers.Serializer):
    cantidad_ventas = serializers.IntegerField()
    total_vendido = serializers.DecimalField(max_digits=14, decimal_places=2)
    impuestos_nacionales = serializers.DecimalField(max_digits=14, decimal_places=2)
    ticket_promedio = serializers.DecimalField(max_digits=14, decimal_places=2)


class MedioPagoIndicadorSerializer(serializers.Serializer):
    medio_pago = serializers.IntegerField()
    nombre = serializers.CharField()
    cantidad_ventas = serializers.IntegerField()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    porcentaje = serializers.DecimalField(max_digits=5, decimal_places=2)


class ProductoMasVendidoSerializer(serializers.Serializer):
    producto = serializers.IntegerField()
    nombre = serializers.CharField()
    unidad = serializers.CharField()
    permite_decimales = serializers.BooleanField()
    cantidad_vendida = serializers.DecimalField(max_digits=14, decimal_places=3)
    importe = serializers.DecimalField(max_digits=14, decimal_places=2)


class CategoriaMasVendidaSerializer(serializers.Serializer):
    categoria = serializers.IntegerField()
    nombre = serializers.CharField()
    importe = serializers.DecimalField(max_digits=14, decimal_places=2)
    porcentaje = serializers.DecimalField(max_digits=5, decimal_places=2)
