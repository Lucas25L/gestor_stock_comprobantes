from rest_framework import serializers

from .models import MedioPago


class MedioPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedioPago
        fields = ('id', 'nombre', 'descripcion', 'activo')
        read_only_fields = ('id', 'activo')

    def validate_nombre(self, valor):
        valor = valor.strip()
        repetidos = MedioPago.objects.filter(nombre__iexact=valor)
        if self.instance is not None:
            repetidos = repetidos.exclude(pk=self.instance.pk)
        if repetidos.exists():
            raise serializers.ValidationError('Ya existe un medio de pago con este nombre.')
        return valor
