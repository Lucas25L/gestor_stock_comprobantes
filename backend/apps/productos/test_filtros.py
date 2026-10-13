from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Producto

URL = '/api/productos/'


def filas(respuesta):
    datos = respuesta.data
    return datos['results'] if isinstance(datos, dict) else datos


class FiltrosDeProductosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        cls.bebidas = Categoria.objects.create(nombre='Bebidas')
        cls.almacen = Categoria.objects.create(nombre='Almacén')
        cls.por_unidad = UnidadMedida.objects.get(abreviatura='u')
        cls.por_kilo = UnidadMedida.objects.get(abreviatura='kg')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa cola', descripcion='Botella de litro y medio', precio=Decimal('1500.00'),
            stock=Decimal('10'), categoria=cls.bebidas, unidad=cls.por_unidad, codigo_barras='7790001',
        )
        cls.pan = Producto.objects.create(
            nombre='Pan francés', precio=Decimal('2000.00'), stock=Decimal('2.500'),
            categoria=cls.almacen, unidad=cls.por_kilo,
        )
        cls.arroz = Producto.objects.create(
            nombre='Arroz largo fino', descripcion='Paquete cerrado', precio=Decimal('900.00'),
            stock=Decimal('40'), categoria=cls.almacen, unidad=cls.por_kilo,
        )
        cls.agua = Producto.objects.create(
            nombre='Agua mineral', precio=Decimal('300.00'), stock=Decimal('0'),
            categoria=cls.bebidas, unidad=cls.por_unidad, activo=False,
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)

    def _ids(self, **params):
        respuesta = self.cliente.get(URL, params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return [fila['id'] for fila in filas(respuesta)]

    def test_rango_de_precio(self):
        self.assertCountEqual(self._ids(precio_min='1000'), [self.gaseosa.pk, self.pan.pk])
        self.assertCountEqual(self._ids(precio_max='1500'), [self.gaseosa.pk, self.arroz.pk])
        self.assertCountEqual(self._ids(precio_min='1000', precio_max='1500'), [self.gaseosa.pk])

    def test_rango_de_stock_incluye_los_extremos(self):
        self.assertCountEqual(self._ids(stock_min='10'), [self.gaseosa.pk, self.arroz.pk])
        self.assertCountEqual(self._ids(stock_max='10'), [self.gaseosa.pk, self.pan.pk])

    def test_filtro_por_categoria(self):
        self.assertCountEqual(self._ids(categoria=self.almacen.pk), [self.pan.pk, self.arroz.pk])
        self.assertCountEqual(self._ids(categoria=self.bebidas.pk), [self.gaseosa.pk])

    def test_filtro_por_unidad(self):
        self.assertCountEqual(self._ids(unidad=self.por_kilo.pk), [self.pan.pk, self.arroz.pk])
        self.assertCountEqual(self._ids(unidad=self.por_unidad.pk), [self.gaseosa.pk])

    def test_los_inactivos_solo_aparecen_con_incluir_inactivos(self):
        self.assertEqual(self._ids(activo='false'), [])
        self.assertEqual(self._ids(activo='false', incluir_inactivos='true'), [self.agua.pk])
        self.assertEqual(len(self._ids(incluir_inactivos='true')), 4)

    def test_busqueda_por_nombre_descripcion_codigo_de_barras_y_categoria(self):
        self.assertEqual(self._ids(search='gaseosa'), [self.gaseosa.pk])
        self.assertEqual(self._ids(search='litro y medio'), [self.gaseosa.pk])
        self.assertEqual(self._ids(search='7790001'), [self.gaseosa.pk])
        self.assertCountEqual(self._ids(search='Almacén'), [self.pan.pk, self.arroz.pk])

    def test_orden_ascendente_y_descendente(self):
        self.assertEqual(
            self._ids(ordering='-precio'), [self.pan.pk, self.gaseosa.pk, self.arroz.pk]
        )
        self.assertEqual(
            self._ids(ordering='nombre'), [self.arroz.pk, self.gaseosa.pk, self.pan.pk]
        )

    def test_filtros_combinados(self):
        self.assertEqual(self._ids(categoria=self.almacen.pk, stock_min='10'), [self.arroz.pk])
        self.assertEqual(self._ids(search='a', unidad=self.por_unidad.pk), [self.gaseosa.pk])

    def test_valores_invalidos_devuelven_400(self):
        invalidos = (
            {'precio_min': 'abc'}, {'precio_max': 'abc'}, {'stock_min': 'abc'},
            {'stock_max': 'abc'}, {'categoria': '999999'}, {'unidad': '999999'},
        )
        for parametros in invalidos:
            with self.subTest(parametros=parametros):
                self.assertEqual(self.cliente.get(URL, parametros).status_code, 400)

    def test_sin_autenticar_devuelve_401(self):
        self.assertEqual(APIClient().get(URL, {'precio_min': '1'}).status_code, 401)
