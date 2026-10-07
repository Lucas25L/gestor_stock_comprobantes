from django.contrib import admin

from .models import UnidadMedida


@admin.register(UnidadMedida)
class UnidadMedidaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'abreviatura', 'permite_decimales', 'activo')
    list_filter = ('activo', 'permite_decimales')
    search_fields = ('nombre', 'abreviatura')