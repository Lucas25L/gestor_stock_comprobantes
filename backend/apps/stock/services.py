from collections import defaultdict
from decimal import Decimal

from django.db import transaction

from apps.productos.models import Producto

from .models import MovimientoStock

Tipo = MovimientoStock.Tipo


class StockError(Exception):
    """Error de negocio del stock. Las vistas lo traducen a una respuesta 400."""


class StockInsuficienteError(StockError):
    def __init__(self, producto, disponible, solicitado):
        self.producto = producto
        self.disponible = disponible
        self.solicitado = solicitado
        super().__init__(
            f'Stock insuficiente para "{producto.nombre}". '
            f'Disponible: {disponible}, solicitado: {solicitado}.'
        )


def _como_decimal(cantidad):
    return Decimal(str(cantidad))


def _exigir_positiva(cantidad):
    cantidad = _como_decimal(cantidad)
    if cantidad <= 0:
        raise StockError('La cantidad debe ser mayor que cero.')
    return cantidad


def _aplicar(*, usuario, tipo, lineas, motivo='', referencia=''):
    """Núcleo del servicio: aplica `lineas` = [(producto, variación con signo)].

    - Todo o nada: si una línea falla, no se modifica ningún producto.
    - Bloquea las filas de los productos (SELECT ... FOR UPDATE) mientras dura la
      transacción, y siempre en orden de id, para evitar pisadas y deadlocks.
    - Suma las líneas repetidas de un mismo producto antes de validar el stock.
    - Usa únicamente el id de cada producto: el stock se lee de la base, ya
      bloqueado, y nunca del objeto que llega por parámetro.
    """
    motivo = (motivo or '').strip()
    if tipo in (Tipo.INGRESO, Tipo.AJUSTE) and not motivo:
        raise StockError('El motivo es obligatorio.')

    variaciones = defaultdict(Decimal)
    for producto, variacion in lineas:
        variaciones[producto.pk] += _como_decimal(variacion)
    if not variaciones:
        raise StockError('No hay productos para procesar.')

    with transaction.atomic():
        bloqueados = (
            Producto.objects.select_for_update(of=('self',))
            .select_related('unidad')
            .filter(pk__in=list(variaciones))
            .order_by('pk')
        )
        productos = {producto.pk: producto for producto in bloqueados}

        movimientos = []
        for pk in sorted(variaciones):
            producto = productos.get(pk)
            if producto is None:
                raise StockError(f'El producto {pk} no existe.')

            variacion = variaciones[pk]
            if variacion == 0:
                raise StockError(f'La cantidad de "{producto.nombre}" no puede ser cero.')
            if not producto.unidad.admite_cantidad(abs(variacion)):
                raise StockError(
                    f'"{producto.nombre}" se maneja por {producto.unidad.nombre.lower()} '
                    f'y solo admite cantidades enteras.'
                )
            if tipo == Tipo.INGRESO and not producto.activo:
                raise StockError(
                    f'"{producto.nombre}" está desactivado y no puede recibir ingresos de mercadería.'
                )

            nuevo_stock = producto.stock + variacion
            if nuevo_stock < 0:
                raise StockInsuficienteError(producto, producto.stock, -variacion)

            producto.stock = nuevo_stock
            producto.save(update_fields=['stock', 'actualizado_en'])
            movimientos.append(
                MovimientoStock(
                    producto=producto,
                    usuario=usuario,
                    tipo=tipo,
                    cantidad=variacion,
                    stock_resultante=nuevo_stock,
                    motivo=motivo,
                    referencia_origen=referencia,
                )
            )

        return MovimientoStock.objects.bulk_create(movimientos)


def registrar_ingreso(*, usuario, producto, cantidad, motivo, referencia=''):
    """Ingreso de mercadería (RF-17). El producto debe estar activo (RN-10)."""
    cantidad = _exigir_positiva(cantidad)
    return _aplicar(
        usuario=usuario, tipo=Tipo.INGRESO, lineas=[(producto, cantidad)],
        motivo=motivo, referencia=referencia,
    )[0]


def registrar_ajuste(*, usuario, producto, cantidad, motivo):
    """Ajuste manual (RF-18). `cantidad` lleva signo: positiva suma, negativa resta."""
    return _aplicar(
        usuario=usuario, tipo=Tipo.AJUSTE, lineas=[(producto, _como_decimal(cantidad))],
        motivo=motivo, referencia='ajuste manual',
    )[0]


def descontar_por_venta(*, usuario, lineas, referencia=''):
    """Descuenta el stock de una venta confirmada (RF-20 a RF-22)."""
    lineas = [(producto, -_exigir_positiva(cantidad)) for producto, cantidad in lineas]
    return _aplicar(usuario=usuario, tipo=Tipo.VENTA, lineas=lineas, referencia=referencia)


def reponer_por_anulacion(*, usuario, lineas, referencia=''):
    """Restituye el stock de una venta anulada (RN-15)."""
    lineas = [(producto, _exigir_positiva(cantidad)) for producto, cantidad in lineas]
    return _aplicar(
        usuario=usuario, tipo=Tipo.ANULACION_VENTA, lineas=lineas, referencia=referencia
    )
