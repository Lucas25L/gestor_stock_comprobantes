from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

URL = '/api/ventas/'


def filas(respuesta):
    datos = respuesta.data
    return datos['results'] if isinstance(datos, dict) else datos


class CamposParaElHistorialTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        categoria = Categoria.objects.create(nombre='Almacén')
        cls.efectivo = MedioPago.objects.get(nombre='Efectivo')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('100'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000.00'), stock=Decimal('100.000'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='kg'),
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)
        cuerpo = {
            'medio_pago': self.efectivo.pk,
            'items': [
                {'producto': self.gaseosa.pk, 'cantidad': '2'},
                {'producto': self.pan.pk, 'cantidad': '1.500'},
            ],
        }
        respuesta = self.cliente.post(URL, cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.venta = respuesta.data

    def test_la_venta_informa_quien_vendio(self):
        self.assertEqual(self.venta['usuario_username'], 'cajero')

    def test_cada_detalle_informa_la_unidad_de_medida(self):
        unidades = {d['producto_nombre']: d['unidad_abreviatura'] for d in self.venta['detalles']}
        self.assertEqual(unidades, {'Gaseosa': 'u', 'Pan': 'kg'})

    def test_venta_sin_comprobante(self):
        self.assertIsNone(self.venta['comprobante'])
        self.assertIsNone(self.venta['comprobante_numero'])

    def test_venta_con_comprobante_en_detalle_y_listado(self):
        emision = self.cliente.post('/api/comprobantes/', {'venta': self.venta['id']}, format='json')
        self.assertEqual(emision.status_code, 201, emision.data)

        detalle = self.cliente.get(f'{URL}{self.venta["id"]}/')
        self.assertEqual(detalle.status_code, 200, detalle.data)
        self.assertEqual(detalle.data['comprobante'], emision.data['id'])
        self.assertEqual(detalle.data['comprobante_numero'], emision.data['numero_formateado'])

        listado = self.cliente.get(URL)
        self.assertEqual(listado.status_code, 200, listado.data)
        fila = next(f for f in filas(listado) if f['id'] == self.venta['id'])
        self.assertEqual(fila['comprobante'], emision.data['id'])
        self.assertEqual(fila['comprobante_numero'], emision.data['numero_formateado'])

    def test_el_listado_no_hace_una_consulta_por_venta(self):
        for _ in range(3):
            cuerpo = {
                'medio_pago': self.efectivo.pk,
                'items': [{'producto': self.gaseosa.pk, 'cantidad': '1'}],
            }
            self.assertEqual(self.cliente.post(URL, cuerpo, format='json').status_code, 201)

        # Cuatro consultas fijas: ventas (con sus JOIN), detalles, productos y unidades.
        with self.assertNumQueries(4):
            respuesta = self.cliente.get(URL)
        self.assertEqual(len(filas(respuesta)), 4)
