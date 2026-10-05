from .models import Rol, Usuario


def es_ultimo_administrador(usuario):
    """True si no existe ningún otro Administrador activo además de `usuario`."""
    return not (
        Usuario.objects.filter(rol__nombre=Rol.Nombre.ADMINISTRADOR, is_active=True)
        .exclude(pk=usuario.pk)
        .exists()
    )