from rest_framework import serializers

from .models import Comprobante


class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = ('id', 'venta', 'numero', 'fecha_emision', 'estado')
        read_only_fields = ('id', 'numero', 'fecha_emision', 'estado')

    def create(self, validated_data):
        ultimo = Comprobante.objects.order_by('-numero').first()
        siguiente_numero = (ultimo.numero + 1) if ultimo else 1

        return Comprobante.objects.create(
            venta=validated_data['venta'],
            numero=siguiente_numero,
        )