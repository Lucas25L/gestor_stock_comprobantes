from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

URL = '/api/comprobantes/'


def filas(respuesta):
    datos = respuesta.data
    return datos['results'] if isinstance(datos, dict) else datos


class FiltrosDeComprobantesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        def crear(nombre):
            return Usuario.objects.create_user(
                username=nombre.lower(), password='clave-de-prueba-123',
                rol=Rol.objects.get(nombre=nombre),
            )

        cls.cajero = crear('Cajero')
        cls.repositor = crear('Repositor')
        categoria = Categoria.objects.create(nombre='Almacén')
        cls.efectivo = MedioPago.objects.get(nombre='Efectivo')
        cls.transferencia, _ = MedioPago.objects.get_or_create(nombre='Transferencia')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('100'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000.00'), stock=Decimal('100.000'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='kg'),
        )

    def _vender(self, medio, *items):
        cuerpo = {
            'medio_pago': medio.pk,
            'items': [{'producto': p.pk, 'cantidad': c} for p, c in items],
        }
        respuesta = self.cliente.post('/api/ventas/', cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data['id']

    def _emitir(self, venta_id):
        respuesta = self.cliente.post(URL, {'venta': venta_id}, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data['numero']

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)
        # Comprobante 1: efectivo | 2: transferencia | 3: efectivo y luego su venta se anula.
        self.venta_a = self._vender(self.efectivo, (self.gaseosa, '2'))
        self.venta_b = self._vender(self.transferencia, (self.pan, '1'))
        self.venta_c = self._vender(self.efectivo, (self.gaseosa, '1'))
        self.n1 = self._emitir(self.venta_a)
        self.n2 = self._emitir(self.venta_b)
        self.n3 = self._emitir(self.venta_c)
        anulacion = self.cliente.post(
            f'/api/ventas/{self.venta_c}/anular/', {'motivo': 'Error de carga'}, format='json'
        )
        self.assertEqual(anulacion.status_code, 200, anulacion.data)

    def _numeros(self, **params):
        respuesta = self.cliente.get(URL, params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return [fila['numero'] for fila in filas(respuesta)]

    def test_filtro_por_venta_conserva_el_parametro_existente(self):
        self.assertEqual(self._numeros(venta=self.venta_b), [self.n2])

    def test_filtro_por_estado(self):
        self.assertCountEqual(self._numeros(estado='emitido'), [self.n1, self.n2])
        self.assertEqual(self._numeros(estado='anulado'), [self.n3])

    def test_filtro_por_medio_de_pago_de_la_venta(self):
        self.assertEqual(self._numeros(medio_pago=self.transferencia.pk), [self.n2])
        self.assertCountEqual(self._numeros(medio_pago=self.efectivo.pk), [self.n1, self.n3])

    def test_filtro_por_numero_y_rango_de_numeros(self):
        self.assertEqual(self._numeros(numero=self.n2), [self.n2])
        self.assertCountEqual(self._numeros(numero_desde=self.n2), [self.n2, self.n3])
        self.assertCountEqual(self._numeros(numero_hasta=self.n2), [self.n1, self.n2])
        self.assertEqual(self._numeros(numero_desde=self.n2, numero_hasta=self.n2), [self.n2])

    def test_rango_de_fechas_de_emision(self):
        hoy = timezone.localdate()
        ayer = (hoy - timedelta(days=1)).isoformat()
        manana = (hoy + timedelta(days=1)).isoformat()
        todos = [self.n1, self.n2, self.n3]
        self.assertCountEqual(self._numeros(desde=hoy.isoformat(), hasta=hoy.isoformat()), todos)
        self.assertEqual(self._numeros(desde=manana), [])
        self.assertEqual(self._numeros(hasta=ayer), [])

    def test_orden_por_numero(self):
        self.assertEqual(self._numeros(ordering='-numero'), [self.n3, self.n2, self.n1])
        self.assertEqual(self._numeros(ordering='numero'), [self.n1, self.n2, self.n3])

    def test_filtros_combinados(self):
        self.assertEqual(
            self._numeros(medio_pago=self.efectivo.pk, estado='emitido'), [self.n1]
        )

    def test_valores_invalidos_devuelven_400(self):
        invalidos = (
            {'venta': 'abc'}, {'estado': 'otro'}, {'medio_pago': 'abc'},
            {'numero_desde': 'abc'}, {'numero_hasta': 'abc'}, {'desde': '2026-13-45'},
        )
        for parametros in invalidos:
            with self.subTest(parametros=parametros):
                self.assertEqual(self.cliente.get(URL, parametros).status_code, 400)

    def test_el_repositor_no_puede_consultar_comprobantes(self):
        self.cliente.force_authenticate(user=self.repositor)
        self.assertEqual(self.cliente.get(URL, {'estado': 'emitido'}).status_code, 403)
