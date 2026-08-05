from django.contrib import admin

from .models import DetalleVenta, Venta


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0
    readonly_fields = ('producto', 'cantidad', 'precio_unitario', 'subtotal')
    can_delete = False


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'fecha', 'total', 'activa')
    list_filter = ('activa', 'usuario')
    ordering = ('-fecha',)
    readonly_fields = ('usuario', 'fecha', 'total', 'impuestos_nacionales')
    inlines = (DetalleVentaInline,)