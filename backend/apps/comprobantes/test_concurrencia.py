import threading
from decimal import Decimal

from django.db import connection, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Comprobante


class ConcurrenciaDeComprobantesApiTests(TransactionTestCase):
    """Emisiones simultáneas por la API real, con hilos y una conexión por hilo."""

    def setUp(self):
        self.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        categoria = Categoria.objects.create(nombre='Bebidas')
        self.producto = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500'), stock=Decimal('100'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        self.efectivo = MedioPago.objects.get(nombre='Efectivo')

    def _fixture_teardown(self):
        # Se desactivan los triggers de auditoría solo durante la limpieza de la base
        # temporal de pruebas, y se reinicia el contador de comprobantes.
        with connection.cursor() as cursor:
            cursor.execute('ALTER TABLE auditoria_auditoria DISABLE TRIGGER USER')
            try:
                cursor.execute('DELETE FROM auditoria_auditoria')
            finally:
                cursor.execute('ALTER TABLE auditoria_auditoria ENABLE TRIGGER USER')
            cursor.execute('DELETE FROM comprobantes_comprobante')
            cursor.execute('UPDATE comprobantes_contadorcomprobante SET ultimo_numero = 0')
            cursor.execute('DELETE FROM stock_movimientostock')
            cursor.execute('DELETE FROM ventas_detalleventa')
            cursor.execute('DELETE FROM ventas_venta')
        Producto.objects.all().delete()
        Categoria.objects.all().delete()
        Usuario.objects.all().delete()

    def _cliente(self):
        cliente = APIClient()
        cliente.force_authenticate(user=self.cajero)
        return cliente

    def _vender(self):
        respuesta = self._cliente().post(
            '/api/ventas/',
            {
                'medio_pago': self.efectivo.pk,
                'items': [{'producto': self.producto.pk, 'cantidad': '1'}],
            },
            format='json',
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data['id']

    def _en_hilos(self, ventas):
        resultados = [None] * len(ventas)
        arranque = threading.Barrier(len(ventas))

        def emitir(indice, venta_id):
            try:
                cliente = self._cliente()
                arranque.wait()
                respuesta = cliente.post('/api/comprobantes/', {'venta': venta_id}, format='json')
                resultados[indice] = (respuesta.status_code, respuesta.data.get('numero'))
            except Exception as error:  # se informa en el hilo principal
                resultados[indice] = error
            finally:
                connections.close_all()

        hilos = [threading.Thread(target=emitir, args=(i, v)) for i, v in enumerate(ventas)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()
        return resultados

    def test_diez_emisiones_simultaneas_dan_numeros_unicos_y_sin_huecos(self):
        ventas = [self._vender() for _ in range(10)]
        resultados = self._en_hilos(ventas)

        self.assertTrue(all(r[0] == 201 for r in resultados), resultados)
        self.assertEqual(sorted(r[1] for r in resultados), list(range(1, 11)))
        self.assertEqual(Comprobante.objects.count(), 10)

    def test_cinco_emisiones_simultaneas_de_la_misma_venta_dan_un_solo_comprobante(self):
        venta = self._vender()
        resultados = self._en_hilos([venta] * 5)

        self.assertTrue(all(isinstance(r, tuple) for r in resultados), resultados)
        estados = sorted(r[0] for r in resultados)
        self.assertEqual(estados, [201, 400, 400, 400, 400], resultados)
        self.assertEqual(Comprobante.objects.count(), 1)
        self.assertEqual(Comprobante.objects.get().numero, 1)
