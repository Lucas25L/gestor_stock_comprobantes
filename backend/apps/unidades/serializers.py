from rest_framework import serializers

from .models import UnidadMedida


class UnidadMedidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnidadMedida
        fields = ('id', 'nombre', 'abreviatura', 'permite_decimales', 'activo')
        read_only_fields = ('id', 'activo')

    def _validar_unico_sin_distinguir_mayusculas(self, campo, valor):
        repetidas = UnidadMedida.objects.filter(**{f'{campo}__iexact': valor})
        if self.instance is not None:
            repetidas = repetidas.exclude(pk=self.instance.pk)
        if repetidas.exists():
            raise serializers.ValidationError('Ya existe una unidad con este valor.')
        return valor

    def validate_nombre(self, valor):
        return self._validar_unico_sin_distinguir_mayusculas('nombre', valor.strip())

    def validate_abreviatura(self, valor):
        return self._validar_unico_sin_distinguir_mayusculas('abreviatura', valor.strip())