from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class Rol(models.Model):
    class Nombre(models.TextChoices):
        ADMINISTRADOR = 'Administrador', 'Administrador'
        CAJERO = 'Cajero', 'Cajero/a'
        REPOSITOR = 'Repositor', 'Repositor/a'

    nombre = models.CharField(max_length=30, unique=True, choices=Nombre.choices)
    descripcion = models.CharField(max_length=255, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Rol'
        verbose_name_plural = 'Roles'
        ordering = ('id',)

    def __str__(self):
        return self.get_nombre_display()


class UsuarioManager(UserManager):
    """Garantiza que un superusuario creado por consola siempre tenga rol (RN-01)."""

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        rol_admin, _ = Rol.objects.get_or_create(nombre=Rol.Nombre.ADMINISTRADOR)
        extra_fields.setdefault('rol', rol_admin)
        return super().create_superuser(username, email, password, **extra_fields)


class Usuario(AbstractUser):
    # `is_active` de Django cumple el rol del campo `activo` del SPS.
    rol = models.ForeignKey(
        Rol,
        on_delete=models.PROTECT,
        related_name='usuarios',
    )

    objects = UsuarioManager()

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f'{self.username} ({self.rol})'