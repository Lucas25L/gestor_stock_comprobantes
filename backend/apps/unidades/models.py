from decimal import Decimal

from django.db import models


class UnidadMedida(models.Model):
    nombre = models.CharField(max_length=50, unique=True)
    abreviatura = models.CharField(max_length=10, unique=True)
    permite_decimales = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)  # No eliminamos, solo desactivamos

    class Meta:
        verbose_name = 'Unidad de medida'
        verbose_name_plural = 'Unidades de medida'
        ordering = ('nombre',)

    def __str__(self):
        return f'{self.nombre} ({self.abreviatura})'

    def admite_cantidad(self, cantidad):
        """True si `cantidad` es válida para esta unidad (entera si no permite decimales)."""
        cantidad = Decimal(cantidad)
        return self.permite_decimales or cantidad == cantidad.to_integral_value()
