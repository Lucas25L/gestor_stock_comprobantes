from rest_framework import serializers

from .models import Auditoria


class AuditoriaSerializer(serializers.ModelSerializer):
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = Auditoria
        fields = (
            'id', 'usuario', 'usuario_username', 'accion', 'entidad',
            'id_registro_afectado', 'fecha_hora', 'detalle',
        )
        read_only_fields = fields