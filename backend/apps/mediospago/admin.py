from django.contrib import admin

from .models import MedioPago


@admin.register(MedioPago)
class MedioPagoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'descripcion', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre',)
