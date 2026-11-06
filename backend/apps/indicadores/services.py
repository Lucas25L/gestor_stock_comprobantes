"""Consultas de indicadores de ventas (RF-43 a RF-46).

Todas excluyen las ventas anuladas (activa=False) y filtran el período por día
calendario en la zona horaria del proyecto, igual que el listado de ventas.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Sum

from apps.ventas.models import DetalleVenta, Venta

CERO = Decimal('0.00')
CENTAVO = Decimal('0.01')
LIMITE_POR_DEFECTO = 10
LIMITE_MAXIMO = 50


def _redondear(valor):
    return valor.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def _porcentaje(parte, total):
    if not total:
        return CERO
    return _redondear(parte * 100 / total)


def _ventas_del_periodo(desde, hasta):
    ventas = Venta.objects.filter(activa=True)
    if desde:
        ventas = ventas.filter(fecha__date__gte=desde)
    if hasta:
        ventas = ventas.filter(fecha__date__lte=hasta)
    return ventas


def _detalles_del_periodo(desde, hasta):
    detalles = DetalleVenta.objects.filter(venta__activa=True)
    if desde:
        detalles = detalles.filter(venta__fecha__date__gte=desde)
    if hasta:
        detalles = detalles.filter(venta__fecha__date__lte=hasta)
    return detalles


def resumen(desde=None, hasta=None):
    """RF-43: cantidad de ventas, total, impuestos y ticket promedio."""
    agregado = _ventas_del_periodo(desde, hasta).aggregate(
        cantidad_ventas=Count('id'),
        total_vendido=Sum('total'),
        impuestos_nacionales=Sum('impuestos_nacionales'),
    )
    cantidad = agregado['cantidad_ventas']
    total = agregado['total_vendido'] or CERO
    return {
        'cantidad_ventas': cantidad,
        'total_vendido': total,
        'impuestos_nacionales': agregado['impuestos_nacionales'] or CERO,
        'ticket_promedio': _redondear(total / cantidad) if cantidad else CERO,
    }


def por_medio_pago(desde=None, hasta=None):
    """RF-44: ventas y total agrupados por medio de pago, con su porcentaje."""
    filas = list(
        _ventas_del_periodo(desde, hasta)
        .values('medio_pago', 'medio_pago__nombre')
        .annotate(cantidad_ventas=Count('id'), total=Sum('total'))
        .order_by('-total', 'medio_pago__nombre')
    )
    total_general = sum((fila['total'] for fila in filas), CERO)
    return [
        {
            'medio_pago': fila['medio_pago'],
            'nombre': fila['medio_pago__nombre'],
            'cantidad_ventas': fila['cantidad_ventas'],
            'total': fila['total'],
            'porcentaje': _porcentaje(fila['total'], total_general),
        }
        for fila in filas
    ]


def productos_mas_vendidos(desde=None, hasta=None, limite=LIMITE_POR_DEFECTO, unidad=None):
    """RF-45: productos con mayor cantidad vendida, en la unidad de cada producto."""
    detalles = _detalles_del_periodo(desde, hasta)
    if unidad:
        detalles = detalles.filter(producto__unidad=unidad)
    filas = (
        detalles.values(
            'producto',
            'producto__nombre',
            'producto__unidad__abreviatura',
            'producto__unidad__permite_decimales',
        )
        .annotate(cantidad_vendida=Sum('cantidad'), importe=Sum('subtotal'))
        .order_by('-cantidad_vendida', 'producto__nombre')[:limite]
    )
    return [
        {
            'producto': fila['producto'],
            'nombre': fila['producto__nombre'],
            'unidad': fila['producto__unidad__abreviatura'],
            'permite_decimales': fila['producto__unidad__permite_decimales'],
            'cantidad_vendida': fila['cantidad_vendida'],
            'importe': fila['importe'],
        }
        for fila in filas
    ]


def categorias_mas_vendidas(desde=None, hasta=None, limite=LIMITE_POR_DEFECTO):
    """RF-46: importe vendido por categoría (según la categoría actual del producto)."""
    detalles = _detalles_del_periodo(desde, hasta)
    total_general = detalles.aggregate(total=Sum('subtotal'))['total'] or CERO
    filas = (
        detalles.values('producto__categoria', 'producto__categoria__nombre')
        .annotate(importe=Sum('subtotal'))
        .order_by('-importe', 'producto__categoria__nombre')[:limite]
    )
    return [
        {
            'categoria': fila['producto__categoria'],
            'nombre': fila['producto__categoria__nombre'],
            'importe': fila['importe'],
            'porcentaje': _porcentaje(fila['importe'], total_general),
        }
        for fila in filas
    ]
