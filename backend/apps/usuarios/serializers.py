from django.contrib.auth import get_user_model, password_validation

from rest_framework import serializers

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Rol
from .services import es_ultimo_administrador


""" Serializers personalizados para tokens JWT """
User = get_user_model()

def datos_usuario(usuario):
    """Datos del usuario que viajan en las respuestas de login y refresh."""
    return {
        'id': usuario.id,
        'username': usuario.username,
        'email': usuario.email,
        'rol': usuario.rol.nombre,
    }

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer): # heredamos de TokenObtainPairSerializer para personalizar la respuesta del endpoint de login
    def validate(self, attrs):
        data = super().validate(attrs) # accedemos a la implementacion de TokenObtainPairSerializer

        data['usuario'] = datos_usuario(self.user)

        return data


class CookieTokenRefreshSerializer(TokenRefreshSerializer): # heredamos de TokenRefreshSerializer para personalizar la respuesta del endpoint de refresh token
    refresh = None

    def validate(self, attrs):
        attrs['refresh'] = self.context['request'].COOKIES.get('refresh_token')

        if not attrs['refresh']:
            raise serializers.ValidationError('No se encontró el refresh token en la cookie.')

        # Leemos el user_id ANTES de validar, porque super().validate()
        # rota y blacklistea este token — después ya no se puede reconstruir.
        token_original = RefreshToken(attrs['refresh'])
        user_id = token_original['user_id']

        data = super().validate(attrs)

        usuario = User.objects.select_related('rol').get(id=user_id)
        data['usuario'] = datos_usuario(usuario)

        return data


class LogoutSerializer(serializers.Serializer):
    def validate(self, attrs):
        refresh_token = self.context['request'].COOKIES.get('refresh_token')

        if not refresh_token: # si no hay refresh token en la cookie, lanzamos un error de validación
            raise serializers.ValidationError('No se encontró el refresh token en la cookie.')

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            raise serializers.ValidationError('Token inválido o ya expirado.')

        return attrs # si todo es correcto, devolvemos los atributos validados (aunque no hay nada que devolver en este caso)

class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ('id', 'nombre', 'descripcion', 'activo')
        read_only_fields = fields


class UsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, style={'input_type': 'password'}
    )
    rol = serializers.PrimaryKeyRelatedField(queryset=Rol.objects.filter(activo=True))
    rol_nombre = serializers.CharField(source='rol.nombre', read_only=True)

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'rol', 'rol_nombre', 'is_active', 'password', 'date_joined',
        )
        read_only_fields = ('id', 'is_active', 'date_joined')

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def validate(self, attrs):
        if self.instance is None and 'password' not in attrs:
            raise serializers.ValidationError({'password': 'Este campo es obligatorio.'})

        nuevo_rol = attrs.get('rol')
        if self.instance is not None and nuevo_rol and nuevo_rol != self.instance.rol:
            era_admin = self.instance.rol.nombre == Rol.Nombre.ADMINISTRADOR
            if era_admin and self.instance.is_active and es_ultimo_administrador(self.instance):
                raise serializers.ValidationError(
                    {'rol': 'No se puede quitar el rol al último administrador activo.'}
                )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        usuario = super().update(instance, validated_data)
        if password:
            usuario.set_password(password)
            usuario.save(update_fields=['password'])
        return usuario