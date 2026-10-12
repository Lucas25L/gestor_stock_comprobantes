from django.contrib import admin

from .models import Comprobante


@admin.register(Comprobante)
class ComprobanteAdmin(admin.ModelAdmin):
    list_display = ('numero', 'venta', 'estado', 'fecha_emision')
    search_fields = ('numero',)
    ordering = ('-fecha_emision',)
    readonly_fields = ('numero', 'venta', 'estado', 'fecha_emision', 'contenido')
