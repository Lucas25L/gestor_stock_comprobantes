from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken

""" Serializers personalizados para tokens JWT """
User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer): # heredamos de TokenObtainPairSerializer para personalizar la respuesta del endpoint de login
    def validate(self, attrs):
        data = super().validate(attrs) # accedemos a la implementacion de TokenObtainPairSerializer

        data['usuario'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
        }

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

        usuario = User.objects.get(id=user_id)
        data['usuario'] = {
            'id': usuario.id,
            'username': usuario.username,
            'email': usuario.email,
        }

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