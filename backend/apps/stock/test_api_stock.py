from decimal import Decimal
from unittest import mock

from django.db import DatabaseError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.auditoria.models import Auditoria
from apps.categorias.models import Categoria
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import MovimientoStock

INGRESOS = '/api/stock/ingresos/'
AJUSTES = '/api/stock/ajustes/'
MOVIMIENTOS = '/api/stock/movimientos/'


class ApiStockTests(TestCase):
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
        cls.por_unidad = UnidadMedida.objects.get(abreviatura='u')
        cls.por_kilo = UnidadMedida.objects.get(abreviatura='kg')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500'), stock=Decimal('10'),
            categoria=categoria, unidad=cls.por_unidad,
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000'), stock=Decimal('2.500'),
            categoria=categoria, unidad=cls.por_kilo,
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.repositor)

    def _ingreso(self, producto=None, cantidad='5', motivo='Compra a proveedor', **extra):
        datos = {'producto': (producto or self.gaseosa).pk, 'cantidad': cantidad, 'motivo': motivo}
        datos.update(extra)
        return self.cliente.post(INGRESOS, datos, format='json')

    def _ajuste(self, producto=None, cantidad='-1', motivo='Rotura'):
        datos = {'producto': (producto or self.gaseosa).pk, 'cantidad': cantidad, 'motivo': motivo}
        return self.cliente.post(AJUSTES, datos, format='json')

    # --- Ingresos ---
    def test_ingreso_suma_stock_registra_movimiento_y_auditoria(self):
        respuesta = self._ingreso(cantidad='5', referencia='remito 123')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['tipo'], 'ingreso')
        self.assertEqual(respuesta.data['cantidad'], '5.000')
        self.assertEqual(respuesta.data['stock_resultante'], '15.000')

        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('15'))
        movimiento = MovimientoStock.objects.get()
        self.assertEqual(movimiento.usuario, self.repositor)
        self.assertEqual(movimiento.referencia_origen, 'remito 123')

        registro = Auditoria.objects.get(accion=Auditoria.Accion.INGRESO_STOCK)
        self.assertEqual(registro.usuario, self.repositor)
        self.assertEqual(registro.entidad, 'Producto')
        self.assertEqual(registro.id_registro_afectado, self.gaseosa.pk)
        self.assertEqual(registro.detalle['cantidad'], '5.000')
        self.assertEqual(registro.detalle['movimiento_id'], movimiento.pk)

    def test_ingreso_acepta_decimales_en_producto_por_peso(self):
        respuesta = self._ingreso(producto=self.pan, cantidad='1.250')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.pan.refresh_from_db()
        self.assertEqual(self.pan.stock, Decimal('3.750'))

    def test_ingreso_rechaza_decimales_en_producto_por_unidad(self):
        respuesta = self._ingreso(cantidad='1.5')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('detail', respuesta.data)
        self.assertFalse(MovimientoStock.objects.exists())
        self.assertFalse(Auditoria.objects.exists())

    def test_ingreso_rechaza_cantidad_cero_negativa_o_con_demasiados_decimales(self):
        for cantidad in ('0', '-3', '0.0001'):
            with self.subTest(cantidad=cantidad):
                respuesta = self._ingreso(cantidad=cantidad)
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn('cantidad', respuesta.data)
        self.assertFalse(MovimientoStock.objects.exists())

    def test_ingreso_exige_motivo(self):
        for motivo in ('', '   '):
            with self.subTest(motivo=repr(motivo)):
                respuesta = self._ingreso(motivo=motivo)
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn('motivo', respuesta.data)

    def test_ingreso_rechaza_producto_desactivado(self):
        Producto.objects.filter(pk=self.gaseosa.pk).update(activo=False)
        respuesta = self._ingreso()
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('detail', respuesta.data)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))

    def test_ingreso_producto_inexistente(self):
        respuesta = self.cliente.post(
            INGRESOS, {'producto': 999999, 'cantidad': '1', 'motivo': 'x'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('producto', respuesta.data)

    # --- Ajustes ---
    def test_ajuste_negativo_resta_y_positivo_suma(self):
        respuesta = self._ajuste(cantidad='-3', motivo='Mercadería vencida')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['stock_resultante'], '7.000')
        self.assertEqual(respuesta.data['tipo'], 'ajuste')

        respuesta = self._ajuste(cantidad='2', motivo='Recuento de inventario')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('9'))
        self.assertEqual(
            Auditoria.objects.filter(accion=Auditoria.Accion.AJUSTE_STOCK).count(), 2
        )

    def test_ajuste_no_puede_dejar_stock_negativo(self):
        respuesta = self._ajuste(cantidad='-11')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('Stock insuficiente', respuesta.data['detail'])
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))
        self.assertFalse(MovimientoStock.objects.exists())
        self.assertFalse(Auditoria.objects.exists())

    def test_ajuste_rechaza_cero_y_exige_motivo(self):
        self.assertEqual(self._ajuste(cantidad='0').status_code, 400)
        respuesta = self._ajuste(motivo='')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('motivo', respuesta.data)

    def test_ajuste_respeta_la_unidad_del_producto(self):
        self.assertEqual(self._ajuste(cantidad='-0.5').status_code, 400)
        respuesta = self._ajuste(producto=self.pan, cantidad='-0.500')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.pan.refresh_from_db()
        self.assertEqual(self.pan.stock, Decimal('2.000'))

    def test_ajuste_sobre_producto_desactivado_esta_permitido(self):
        Producto.objects.filter(pk=self.gaseosa.pk).update(activo=False)
        self.assertEqual(self._ajuste(cantidad='-2').status_code, 201)

    # --- Atomicidad ---
    def test_si_falla_la_auditoria_se_deshace_el_movimiento(self):
        with mock.patch('apps.stock.views.registrar', side_effect=DatabaseError('falla simulada')):
            with self.assertRaises(DatabaseError):
                self._ingreso(cantidad='5')
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))
        self.assertFalse(MovimientoStock.objects.exists())

    # --- Producto de solo lectura ---
    def test_el_stock_del_producto_no_se_modifica_por_la_api_de_productos(self):
        self.cliente.force_authenticate(user=self.admin)
        respuesta = self.cliente.patch(
            f'/api/productos/{self.gaseosa.pk}/', {'stock': '999'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))

    # --- Consulta de movimientos ---
    def test_consulta_de_movimientos_con_filtros(self):
        self._ingreso(cantidad='5', referencia='remito 1')
        self._ajuste(cantidad='-1')
        self._ingreso(producto=self.pan, cantidad='1')

        todos = self.cliente.get(MOVIMIENTOS)
        self.assertEqual(todos.status_code, 200)
        self.assertEqual(todos.data['count'], 3)

        def contar(**params):
            return self.cliente.get(MOVIMIENTOS, params).data['count']

        self.assertEqual(contar(producto=self.gaseosa.pk), 2)
        self.assertEqual(contar(tipo='ajuste'), 1)
        self.assertEqual(contar(usuario=self.repositor.pk), 3)
        self.assertEqual(contar(usuario=self.admin.pk), 0)
        self.assertEqual(contar(referencia='remito 1'), 1)
        self.assertEqual(contar(desde='2000-01-01', hasta='2999-12-31'), 3)
        self.assertEqual(contar(desde='2999-01-01'), 0)

    def test_filtros_invalidos_devuelven_400(self):
        for params in ({'producto': 'abc'}, {'tipo': 'otro'}, {'desde': 'ayer'}, {'usuario': '1x'}):
            with self.subTest(params=params):
                self.assertEqual(self.cliente.get(MOVIMIENTOS, params).status_code, 400)

    def test_detalle_de_un_movimiento(self):
        movimiento = self._ingreso().data
        respuesta = self.cliente.get(f"{MOVIMIENTOS}{movimiento['id']}/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['producto_nombre'], 'Gaseosa')
        self.assertEqual(respuesta.data['usuario_username'], 'repositor')

    def test_los_movimientos_no_se_pueden_modificar_ni_borrar_por_la_api(self):
        movimiento = self._ingreso().data
        url = f"{MOVIMIENTOS}{movimiento['id']}/"
        for metodo in ('put', 'patch', 'delete'):
            with self.subTest(metodo=metodo):
                respuesta = getattr(self.cliente, metodo)(url, {}, format='json')
                self.assertEqual(respuesta.status_code, 405)
        self.assertEqual(self.cliente.post(MOVIMIENTOS, {}, format='json').status_code, 405)

    # --- Permisos ---
    def test_el_cajero_no_puede_operar_el_stock(self):
        self.cliente.force_authenticate(user=self.cajero)
        self.assertEqual(self.cliente.get(MOVIMIENTOS).status_code, 403)
        self.assertEqual(self._ingreso().status_code, 403)
        self.assertEqual(self._ajuste().status_code, 403)

    def test_sin_autenticar_devuelve_401(self):
        self.cliente.force_authenticate(user=None)
        self.assertEqual(self.cliente.get(MOVIMIENTOS).status_code, 401)
        self.assertEqual(self._ingreso().status_code, 401)

    def test_el_administrador_tambien_puede_operar_el_stock(self):
        self.cliente.force_authenticate(user=self.admin)
        self.assertEqual(self._ingreso().status_code, 201)
        self.assertEqual(self.cliente.get(MOVIMIENTOS).status_code, 200)
