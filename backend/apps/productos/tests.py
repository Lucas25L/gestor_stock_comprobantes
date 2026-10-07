from django.test import TestCase

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Producto


class ProductosConUnidadYCantidadesDecimalesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Usuario.objects.create_user(
            username='admin', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Administrador'),
        )
        cls.categoria = Categoria.objects.create(nombre='Panadería')
        cls.por_unidad = UnidadMedida.objects.get(abreviatura='u')
        cls.por_kilo = UnidadMedida.objects.get(abreviatura='kg')

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.admin)

    def _datos(self, **extra):
        datos = {
            'nombre': 'Pan francés', 'precio': '1000.00', 'stock': '0', 'stock_minimo': '0',
            'categoria': self.categoria.pk, 'unidad': self.por_kilo.pk,
        }
        datos.update(extra)
        return datos

    def _crear(self, **extra):
        return self.cliente.post('/api/productos/', self._datos(**extra), format='json')

    def test_crear_producto_con_unidad_devuelve_los_datos_de_la_unidad(self):
        respuesta = self._crear()
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['unidad_abreviatura'], 'kg')
        self.assertTrue(respuesta.data['unidad_permite_decimales'])

    def test_la_unidad_es_obligatoria(self):
        datos = self._datos()
        del datos['unidad']
        respuesta = self.cliente.post('/api/productos/', datos, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('unidad', respuesta.data)

    def test_no_se_puede_asignar_una_unidad_desactivada(self):
        UnidadMedida.objects.filter(pk=self.por_kilo.pk).update(activo=False)
        respuesta = self._crear()
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('unidad', respuesta.data)

    def test_por_kilo_acepta_stock_decimal(self):
        respuesta = self._crear(stock='2.500', stock_minimo='0.750')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        producto = Producto.objects.get(pk=respuesta.data['id'])
        self.assertEqual(producto.stock, Decimal('2.500'))
        self.assertEqual(producto.stock_minimo, Decimal('0.750'))

    def test_por_unidad_rechaza_cantidades_decimales(self):
        respuesta = self._crear(unidad=self.por_unidad.pk, stock='2.5')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('stock', respuesta.data)
        respuesta = self._crear(unidad=self.por_unidad.pk, stock_minimo='1.5')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('stock_minimo', respuesta.data)
        self.assertEqual(self._crear(unidad=self.por_unidad.pk, stock='3').status_code, 201)

    def test_rechaza_mas_de_tres_decimales_y_valores_negativos(self):
        self.assertEqual(self._crear(stock='1.2345').status_code, 400)
        self.assertEqual(self._crear(stock='-1').status_code, 400)
        self.assertEqual(self._crear(stock_minimo='-0.5').status_code, 400)

    def test_cambiar_de_kilo_a_unidad_exige_stock_entero(self):
        creado = self._crear(stock='2.500').data
        url = f"/api/productos/{creado['id']}/"
        respuesta = self.cliente.patch(url, {'unidad': self.por_unidad.pk}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('stock', respuesta.data)

        respuesta = self.cliente.patch(
            url, {'unidad': self.por_unidad.pk, 'stock': '3'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.data)

    def test_la_base_de_datos_rechaza_stock_negativo(self):
        producto = Producto.objects.create(
            nombre='Pan', precio=Decimal('100'), categoria=self.categoria, unidad=self.por_kilo
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Producto.objects.filter(pk=producto.pk).update(stock=Decimal('-0.001'))

    def test_no_se_puede_desactivar_una_unidad_en_uso_por_productos_activos(self):
        producto = self._crear().data
        respuesta = self.cliente.delete(f'/api/unidades/{self.por_kilo.pk}/')
        self.assertEqual(respuesta.status_code, 400)
        self.assertTrue(UnidadMedida.objects.get(pk=self.por_kilo.pk).activo)

        self.cliente.delete(f"/api/productos/{producto['id']}/")
        respuesta = self.cliente.delete(f'/api/unidades/{self.por_kilo.pk}/')
        self.assertEqual(respuesta.status_code, 204)