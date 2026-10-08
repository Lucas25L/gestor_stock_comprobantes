from django.contrib import admin

from .models import MovimientoStock


@admin.register(MovimientoStock)
class MovimientoStockAdmin(admin.ModelAdmin):
    list_display = (
        'fecha_hora', 'producto', 'tipo', 'cantidad', 'stock_resultante',
        'usuario', 'referencia_origen',
    )
    list_filter = ('tipo',)
    search_fields = ('producto__nombre', 'referencia_origen', 'motivo')
    date_hierarchy = 'fecha_hora'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
