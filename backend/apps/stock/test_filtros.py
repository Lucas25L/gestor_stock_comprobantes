from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

INGRESOS = '/api/stock/ingresos/'
AJUSTES = '/api/stock/ajustes/'
MOVIMIENTOS = '/api/stock/movimientos/'


def filas(respuesta):
    datos = respuesta.data
    return datos['results'] if isinstance(datos, dict) else datos


class FiltrosDeMovimientosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        def crear(nombre):
            return Usuario.objects.create_user(
                username=nombre.lower(), password='clave-de-prueba-123',
                rol=Rol.objects.get(nombre=nombre),
            )

        cls.admin = crear('Administrador')
        cls.repositor = crear('Repositor')
        cls.cajero = crear('Cajero')
        categoria = Categoria.objects.create(nombre='Almacén')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500'), stock=Decimal('10'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000'), stock=Decimal('2.500'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='kg'),
        )

    def _registrar(self, url, producto, cantidad, motivo, **extra):
        datos = {'producto': producto.pk, 'cantidad': cantidad, 'motivo': motivo}
        datos.update(extra)
        respuesta = self.cliente.post(url, datos, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)

    def setUp(self):
        self.cliente = APIClient()
        # Cantidades registradas: 5 (ingreso), 2 (ingreso), -1 (ajuste), -0.5 (ajuste del admin).
        self.cliente.force_authenticate(user=self.repositor)
        self._registrar(INGRESOS, self.gaseosa, '5', 'Compra a proveedor', referencia='remito 1')
        self._registrar(INGRESOS, self.pan, '2', 'Compra a proveedor', referencia='remito 2')
        self._registrar(AJUSTES, self.gaseosa, '-1', 'Rotura')
        self.cliente.force_authenticate(user=self.admin)
        self._registrar(AJUSTES, self.pan, '-0.5', 'Merma')
        self.cliente.force_authenticate(user=self.repositor)

    def _cantidades(self, **params):
        respuesta = self.cliente.get(MOVIMIENTOS, params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return [fila['cantidad'] for fila in filas(respuesta)]

    def test_el_listado_esta_paginado(self):
        respuesta = self.cliente.get(MOVIMIENTOS)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 4)

    def test_filtro_por_producto(self):
        self.assertCountEqual(self._cantidades(producto=self.gaseosa.pk), ['5.000', '-1.000'])
        self.assertCountEqual(self._cantidades(producto=self.pan.pk), ['2.000', '-0.500'])

    def test_filtro_por_tipo(self):
        self.assertCountEqual(self._cantidades(tipo='ingreso'), ['5.000', '2.000'])
        self.assertCountEqual(self._cantidades(tipo='ajuste'), ['-1.000', '-0.500'])
        self.assertEqual(self._cantidades(tipo='venta'), [])

    def test_filtro_por_usuario(self):
        self.assertEqual(self._cantidades(usuario=self.admin.pk), ['-0.500'])
        self.assertEqual(len(self._cantidades(usuario=self.repositor.pk)), 3)

    def test_filtro_por_referencia_exacta(self):
        self.assertEqual(self._cantidades(referencia='remito 1'), ['5.000'])
        self.assertEqual(self._cantidades(referencia='remito'), [])

    def test_rango_de_fechas(self):
        hoy = timezone.localdate()
        ayer = (hoy - timedelta(days=1)).isoformat()
        manana = (hoy + timedelta(days=1)).isoformat()
        self.assertEqual(len(self._cantidades(desde=hoy.isoformat(), hasta=hoy.isoformat())), 4)
        self.assertEqual(self._cantidades(desde=manana), [])
        self.assertEqual(self._cantidades(hasta=ayer), [])

    def test_busqueda_por_producto_motivo_y_referencia(self):
        self.assertEqual(self._cantidades(search='Rotura'), ['-1.000'])
        self.assertCountEqual(self._cantidades(search='pan'), ['2.000', '-0.500'])
        self.assertCountEqual(self._cantidades(search='remito'), ['5.000', '2.000'])

    def test_orden_por_cantidad(self):
        self.assertEqual(
            self._cantidades(ordering='-cantidad'), ['5.000', '2.000', '-0.500', '-1.000']
        )

    def test_filtros_combinados(self):
        self.assertEqual(self._cantidades(producto=self.gaseosa.pk, tipo='ajuste'), ['-1.000'])

    def test_valores_invalidos_devuelven_400(self):
        invalidos = (
            {'producto': 'abc'}, {'usuario': 'abc'}, {'tipo': 'otro'}, {'desde': '2026-13-45'},
            {'hasta': 'ayer'},
        )
        for parametros in invalidos:
            with self.subTest(parametros=parametros):
                self.assertEqual(self.cliente.get(MOVIMIENTOS, parametros).status_code, 400)

    def test_el_cajero_no_puede_consultar_movimientos(self):
        self.cliente.force_authenticate(user=self.cajero)
        self.assertEqual(self.cliente.get(MOVIMIENTOS, {'tipo': 'ingreso'}).status_code, 403)
