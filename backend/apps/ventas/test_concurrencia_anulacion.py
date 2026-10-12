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


class ConcurrenciaDeAnulacionesApiTests(TransactionTestCase):
    """Varias anulaciones simultáneas de la misma venta: solo una puede prosperar."""

    def setUp(self):
        self.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        categoria = Categoria.objects.create(nombre='Bebidas')
        self.producto = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500'), stock=Decimal('10'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cliente = APIClient()
        cliente.force_authenticate(user=self.cajero)
        respuesta = cliente.post(
            '/api/ventas/',
            {
                'medio_pago': MedioPago.objects.get(nombre='Efectivo').pk,
                'items': [{'producto': self.producto.pk, 'cantidad': '4'}],
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.venta_id = respuesta.data['id']

    def _fixture_teardown(self):
        # Ver el comentario de ConcurrenciaDeVentasApiTests: se desactiva el trigger de
        # auditoría solo durante la limpieza de la base temporal de pruebas.
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

    def test_cinco_anulaciones_simultaneas_reponen_el_stock_una_sola_vez(self):
        resultados = [None] * 5
        arranque = threading.Barrier(5)

        def anular(indice):
            try:
                cliente = APIClient()
                cliente.force_authenticate(user=self.cajero)
                arranque.wait()
                respuesta = cliente.post(
                    f'/api/ventas/{self.venta_id}/anular/', {'motivo': 'Prueba'}, format='json'
                )
                resultados[indice] = respuesta.status_code
            except Exception as error:  # se informa en el hilo principal
                resultados[indice] = error
            finally:
                connections.close_all()

        hilos = [threading.Thread(target=anular, args=(i,)) for i in range(5)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()

        self.assertEqual(sorted(map(str, resultados)), ['200'] + ['400'] * 4, resultados)
        self.assertEqual(Producto.objects.get(pk=self.producto.pk).stock, Decimal('10'))
        self.assertFalse(Venta.objects.get(pk=self.venta_id).activa)
        self.assertEqual(
            MovimientoStock.objects.filter(tipo=MovimientoStock.Tipo.ANULACION_VENTA).count(), 1
        )
