from rest_framework.permissions import BasePermission

from .models import Rol


class TieneRol(BasePermission):
    """Permite el acceso solo a usuarios activos cuyo rol esté entre los permitidos."""

    roles_permitidos = ()
    message = 'No tiene permisos para realizar esta acción.'

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and usuario.is_active
            and usuario.rol.activo
            and usuario.rol.nombre in self.roles_permitidos
        )


class EsAdministrador(TieneRol):
    roles_permitidos = (Rol.Nombre.ADMINISTRADOR,)


class EsCajero(TieneRol):
    roles_permitidos = (Rol.Nombre.CAJERO,)


class EsRepositor(TieneRol):
    roles_permitidos = (Rol.Nombre.REPOSITOR,)