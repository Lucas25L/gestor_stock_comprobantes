import threading
from decimal import Decimal

from django.db import connection, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.stock.models import MovimientoStock
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Venta


class ConcurrenciaDeVentasApiTests(TransactionTestCase):
    """Ventas simultáneas por la API real, con hilos y una conexión por hilo."""

    def setUp(self):
        self.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        categoria = Categoria.objects.create(nombre='Bebidas')
        self.efectivo = MedioPago.objects.get(nombre='Efectivo')
        self.producto = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500'), stock=Decimal('3'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )

    def _fixture_teardown(self):
        # El vaciado por defecto usa TRUNCATE, que el trigger de auditoría rechaza y que
        # además borraría los datos cargados por migración. Se desactiva el trigger solo
        # durante la limpieza y se vuelve a activar.
        with connection.cursor() as cursor:
            cursor.execute('ALTER TABLE auditoria_auditoria DISABLE TRIGGER USER')
            try:
                cursor.execute('DELETE FROM auditoria_auditoria')
            finally:
                cursor.execute('ALTER TABLE auditoria_auditoria ENABLE TRIGGER USER')
            cursor.execute('DELETE FROM stock_movimientostock')
            cursor.execute('DELETE FROM ventas_detalleventa')
            cursor.execute('DELETE FROM ventas_venta')
        Producto.objects.all().delete()
        Categoria.objects.all().delete()
        Usuario.objects.all().delete()

    def test_diez_ventas_simultaneas_con_stock_para_tres_aceptan_exactamente_tres(self):
        resultados = [None] * 10
        arranque = threading.Barrier(10)

        def vender(indice):
            try:
                cliente = APIClient()
                cliente.force_authenticate(user=self.cajero)
                arranque.wait()
                respuesta = cliente.post(
                    '/api/ventas/',
                    {
                        'medio_pago': self.efectivo.pk,
                        'items': [{'producto': self.producto.pk, 'cantidad': '1'}],
                    },
                    format='json',
                )
                resultados[indice] = respuesta.status_code
            except Exception as error:  # se informa en el hilo principal
                resultados[indice] = error
            finally:
                connections.close_all()

        hilos = [threading.Thread(target=vender, args=(i,)) for i in range(10)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()

        self.assertEqual(sorted(map(str, resultados)), ['201'] * 3 + ['400'] * 7, resultados)
        self.assertEqual(Producto.objects.get(pk=self.producto.pk).stock, Decimal('0'))
        self.assertEqual(Venta.objects.count(), 3)
        self.assertEqual(MovimientoStock.objects.count(), 3)
