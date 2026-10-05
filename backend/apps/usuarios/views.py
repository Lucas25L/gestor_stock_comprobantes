from django.conf import settings

from rest_framework import serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.decorators import action

from .mixins import SetRefreshCookieMixin
from .serializers import (
    RolSerializer,
    UsuarioSerializer,
    CookieTokenRefreshSerializer,
    CustomTokenObtainPairSerializer,
    LogoutSerializer,
)

from .models import Rol, Usuario
from .permissions import EsAdministrador
from .services import es_ultimo_administrador

from django.db import transaction

from apps.auditoria.models import Auditoria
from apps.auditoria.services import registrar

class CustomTokenObtainPairView(SetRefreshCookieMixin, TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CustomTokenRefreshView(SetRefreshCookieMixin, TokenRefreshView):
    serializer_class = CookieTokenRefreshSerializer


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = LogoutSerializer(data={}, context={'request': request})
        serializer.is_valid(raise_exception=True)

        response = Response(status=status.HTTP_205_RESET_CONTENT)
        response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME)
        return response

class UsuarioViewSet(viewsets.ModelViewSet):
    permission_classes = (EsAdministrador,)
    http_method_names = ('get', 'post', 'put', 'patch', 'head', 'options')
    serializer_class = UsuarioSerializer
    queryset = Usuario.objects.select_related('rol').order_by('id')

    def perform_create(self, serializer):
        with transaction.atomic():
            usuario = serializer.save()
            registrar(
                usuario=self.request.user,
                accion=Auditoria.Accion.USUARIO_CREADO,
                entidad='Usuario',
                id_registro=usuario.pk,
                detalle={'username': usuario.username, 'rol': usuario.rol.nombre},
            )

    def perform_update(self, serializer):
        instancia = serializer.instance
        campos = ('username', 'email', 'first_name', 'last_name')
        anteriores = {campo: getattr(instancia, campo) for campo in campos}
        rol_anterior = instancia.rol.nombre

        with transaction.atomic():
            usuario = serializer.save()

            cambios = {
                campo: {'de': valor, 'a': getattr(usuario, campo)}
                for campo, valor in anteriores.items()
                if getattr(usuario, campo) != valor
            }
            if usuario.rol.nombre != rol_anterior:
                cambios['rol'] = {'de': rol_anterior, 'a': usuario.rol.nombre}
            if 'password' in serializer.validated_data:
                cambios['password'] = 'modificada'  # nunca se guarda el valor

            if cambios:
                registrar(
                    usuario=self.request.user,
                    accion=Auditoria.Accion.USUARIO_MODIFICADO,
                    entidad='Usuario',
                    id_registro=usuario.pk,
                    detalle={'username': usuario.username, 'cambios': cambios},
                )

    @action(detail=True, methods=('post',))
    def desactivar(self, request, pk=None):
        usuario = self.get_object()
        if usuario.is_active:
            es_admin = usuario.rol.nombre == Rol.Nombre.ADMINISTRADOR
            if es_admin and es_ultimo_administrador(usuario):
                raise serializers.ValidationError(
                    {'detail': 'No se puede desactivar al último administrador activo.'}
                )
            with transaction.atomic():
                usuario.is_active = False
                usuario.save(update_fields=['is_active'])
                registrar(
                    usuario=request.user,
                    accion=Auditoria.Accion.USUARIO_DESACTIVADO,
                    entidad='Usuario',
                    id_registro=usuario.pk,
                    detalle={'username': usuario.username},
                )
        return Response(self.get_serializer(usuario).data)

    @action(detail=True, methods=('post',))
    def activar(self, request, pk=None):
        usuario = self.get_object()
        if not usuario.is_active:
            with transaction.atomic():
                usuario.is_active = True
                usuario.save(update_fields=['is_active'])
                registrar(
                    usuario=request.user,
                    accion=Auditoria.Accion.USUARIO_ACTIVADO,
                    entidad='Usuario',
                    id_registro=usuario.pk,
                    detalle={'username': usuario.username},
                )
        return Response(self.get_serializer(usuario).data)

class RolViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (EsAdministrador,)
    serializer_class = RolSerializer
    queryset = Rol.objects.filter(activo=True)