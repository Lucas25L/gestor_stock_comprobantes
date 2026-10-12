from rest_framework import serializers

from apps.ventas.models import Venta

from .models import Comprobante


class ComprobanteSerializer(serializers.ModelSerializer):
    venta = serializers.PrimaryKeyRelatedField(queryset=Venta.objects.all())
    numero_formateado = serializers.CharField(read_only=True)

    class Meta:
        model = Comprobante
        fields = (
            'id', 'venta', 'numero', 'numero_formateado', 'fecha_emision', 'estado', 'contenido',
        )
        read_only_fields = ('id', 'numero', 'fecha_emision', 'estado', 'contenido')
