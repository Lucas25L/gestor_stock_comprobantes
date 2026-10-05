from django.db import models


class UnidadMedida(models.Model):
    nombre = models.CharField(max_length=50, unique=True)
    abreviatura = models.CharField(max_length=10, unique=True)
    activo = models.BooleanField(default=True)  # No eliminamos, solo desactivamos

    class Meta:
        verbose_name = 'Unidad de medida'
        verbose_name_plural = 'Unidades de medida'
        ordering = ('nombre',)

    def __str__(self):
        return f'{self.nombre} ({self.abreviatura})'