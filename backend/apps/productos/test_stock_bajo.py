from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Producto

LISTADO = '/api/productos/'
STOCK_BAJO = '/api/productos/stock-bajo/'


def filas(respuesta):
    datos = respuesta.data
    return datos['results'] if isinstance(datos, dict) else datos


class StockBajoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        def crear(nombre):
            return Usuario.objects.create_user(
                username=nombre.lower(), password='clave-de-prueba-123',
                rol=Rol.objects.get(nombre=nombre),
            )

        cls.admin = crear('Administrador')
        cls.cajero = crear('Cajero')
        cls.repositor = crear('Repositor')
        cls.bebidas = Categoria.objects.create(nombre='Bebidas')
        cls.almacen = Categoria.objects.create(nombre='Almacén')
        por_unidad = UnidadMedida.objects.get(abreviatura='u')
        por_kilo = UnidadMedida.objects.get(abreviatura='kg')

        def producto(nombre, categoria, unidad, stock, minimo, **extra):
            return Producto.objects.create(
                nombre=nombre, precio=Decimal('1000.00'), stock=Decimal(stock),
                stock_minimo=Decimal(minimo), categoria=categoria, unidad=unidad, **extra,
            )

        cls.leche = producto('Leche', cls.almacen, por_unidad, '0', '20')
        cls.pan = producto('Pan', cls.almacen, por_kilo, '0.500', '2.000')
        cls.gaseosa = producto('Gaseosa', cls.bebidas, por_unidad, '10', '10')
        cls.arroz = producto('Arroz', cls.almacen, por_kilo, '40', '5')
        cls.agua = producto('Agua', cls.bebidas, por_unidad, '0', '5', activo=False)

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)

    def _ids(self, url, **params):
        respuesta = self.cliente.get(url, params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return [fila['id'] for fila in filas(respuesta)]

    # --- Campos calculados ---
    def test_el_listado_informa_stock_bajo_y_faltante_de_cada_producto(self):
        respuesta = self.cliente.get(LISTADO, {'incluir_inactivos': 'true'})
        por_nombre = {fila['nombre']: fila for fila in filas(respuesta)}
        esperado = {
            'Leche': (True, '20.000'),
            'Pan': (True, '1.500'),
            'Gaseosa': (True, '0.000'),
            'Arroz': (False, '0.000'),
            'Agua': (False, '5.000'),
        }
        for nombre, (bajo, faltante) in esperado.items():
            with self.subTest(producto=nombre):
                self.assertEqual(por_nombre[nombre]['stock_bajo'], bajo)
                self.assertEqual(por_nombre[nombre]['faltante'], faltante)

    def test_stock_igual_al_minimo_cuenta_como_bajo(self):
        self.assertIn(self.gaseosa.pk, self._ids(STOCK_BAJO))

    def test_un_producto_justo_por_encima_del_minimo_no_es_bajo(self):
        Producto.objects.filter(pk=self.gaseosa.pk).update(stock=Decimal('10.001'))
        self.assertNotIn(self.gaseosa.pk, self._ids(STOCK_BAJO))

    # --- Filtro ?stock_bajo= ---
    def test_filtro_stock_bajo_verdadero(self):
        self.assertCountEqual(
            self._ids(LISTADO, stock_bajo='true'), [self.leche.pk, self.pan.pk, self.gaseosa.pk]
        )

    def test_filtro_stock_bajo_falso(self):
        self.assertEqual(self._ids(LISTADO, stock_bajo='false'), [self.arroz.pk])
        self.assertCountEqual(
            self._ids(LISTADO, stock_bajo='false', incluir_inactivos='true'),
            [self.arroz.pk, self.agua.pk],
        )

    def test_un_producto_inactivo_nunca_figura_con_stock_bajo(self):
        self.assertNotIn(
            self.agua.pk, self._ids(LISTADO, stock_bajo='true', incluir_inactivos='true')
        )

    def test_un_valor_booleano_no_reconocido_se_ignora_como_en_los_demas_filtros_booleanos(self):
        self.assertEqual(len(self._ids(LISTADO, stock_bajo='abc')), 4)

    def test_el_filtro_se_combina_con_los_demas(self):
        self.assertEqual(
            self._ids(LISTADO, stock_bajo='true', categoria=self.bebidas.pk), [self.gaseosa.pk]
        )

    # --- Endpoint de reposición ---
    def test_endpoint_lista_los_de_mayor_faltante_primero(self):
        self.assertEqual(
            self._ids(STOCK_BAJO), [self.leche.pk, self.pan.pk, self.gaseosa.pk]
        )

    def test_endpoint_excluye_inactivos_aunque_se_pidan(self):
        self.assertNotIn(self.agua.pk, self._ids(STOCK_BAJO, incluir_inactivos='true'))

    def test_endpoint_acepta_busqueda_filtros_y_orden_propio(self):
        self.assertEqual(self._ids(STOCK_BAJO, search='pan'), [self.pan.pk])
        self.assertEqual(self._ids(STOCK_BAJO, categoria=self.bebidas.pk), [self.gaseosa.pk])
        self.assertEqual(
            self._ids(STOCK_BAJO, ordering='nombre'), [self.gaseosa.pk, self.leche.pk, self.pan.pk]
        )

    def test_endpoint_devuelve_los_campos_calculados(self):
        respuesta = self.cliente.get(STOCK_BAJO)
        primero = filas(respuesta)[0]
        self.assertEqual(primero['nombre'], 'Leche')
        self.assertTrue(primero['stock_bajo'])
        self.assertEqual(primero['faltante'], '20.000')

    def test_endpoint_vacio_cuando_nada_esta_bajo(self):
        Producto.objects.update(stock=Decimal('999'))
        self.assertEqual(self._ids(STOCK_BAJO), [])

    def test_valores_numericos_invalidos_siguen_devolviendo_400(self):
        self.assertEqual(self.cliente.get(STOCK_BAJO, {'precio_min': 'abc'}).status_code, 400)

    # --- Permisos ---
    def test_lo_consultan_los_tres_roles(self):
        for usuario in (self.admin, self.cajero, self.repositor):
            with self.subTest(rol=usuario.username):
                self.cliente.force_authenticate(user=usuario)
                self.assertEqual(self.cliente.get(STOCK_BAJO).status_code, 200)

    def test_sin_autenticar_devuelve_401(self):
        self.assertEqual(APIClient().get(STOCK_BAJO).status_code, 401)

    def test_el_endpoint_es_solo_de_lectura(self):
        # DRF chequea permisos antes que el método: según el rol puede ser 403 o 405.
        # Lo importante es que ninguna escritura prospere.
        for usuario in (self.cajero, self.admin):
            self.cliente.force_authenticate(user=usuario)
            for metodo in ('post', 'put', 'patch', 'delete'):
                with self.subTest(rol=usuario.username, metodo=metodo):
                    respuesta = getattr(self.cliente, metodo)(STOCK_BAJO)
                    self.assertIn(respuesta.status_code, (403, 405))
        self.assertEqual(Producto.objects.count(), 5)
