import threading
from decimal import Decimal

from django.db import IntegrityError, connection, connections, transaction
from django.db.models import Sum
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext

from apps.auditoria.models import RegistroInmutableError
from apps.categorias.models import Categoria
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import MovimientoStock
from .services import (
    StockError,
    StockInsuficienteError,
    descontar_por_venta,
    registrar_ajuste,
    registrar_ingreso,
    reponer_por_anulacion,
)


class ServicioDeStockTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = Usuario.objects.create_user(
            username='repositor', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Repositor'),
        )
        cls.categoria = Categoria.objects.create(nombre='Bebidas')
        cls.unidad = UnidadMedida.objects.get(abreviatura='u')
        cls.kilo = UnidadMedida.objects.get(abreviatura='kg')

    def _producto(self, nombre='Gaseosa', stock='10', unidad=None, **extra):
        return Producto.objects.create(
            nombre=nombre, precio=Decimal('100'), stock=Decimal(stock),
            categoria=self.categoria, unidad=unidad or self.unidad, **extra,
        )

    def _stock(self, producto):
        return Producto.objects.get(pk=producto.pk).stock

    def test_ingreso_suma_stock_y_registra_el_movimiento(self):
        producto = self._producto(stock='10')
        movimiento = registrar_ingreso(
            usuario=self.usuario, producto=producto, cantidad='5', motivo='Compra a proveedor'
        )
        self.assertEqual(self._stock(producto), Decimal('15'))
        self.assertEqual(movimiento.tipo, 'ingreso')
        self.assertEqual(movimiento.cantidad, Decimal('5'))
        self.assertEqual(movimiento.stock_resultante, Decimal('15'))
        self.assertEqual(movimiento.usuario, self.usuario)
        self.assertEqual(movimiento.motivo, 'Compra a proveedor')
        self.assertIsNotNone(movimiento.fecha_hora)

    def test_ingreso_y_ajuste_exigen_motivo(self):
        producto = self._producto()
        with self.assertRaises(StockError):
            registrar_ingreso(usuario=self.usuario, producto=producto, cantidad='1', motivo='  ')
        with self.assertRaises(StockError):
            registrar_ajuste(usuario=self.usuario, producto=producto, cantidad='-1', motivo='')
        self.assertEqual(MovimientoStock.objects.count(), 0)

    def test_un_producto_desactivado_no_recibe_ingresos_pero_si_ajustes(self):
        producto = self._producto(activo=False)
        with self.assertRaises(StockError):
            registrar_ingreso(usuario=self.usuario, producto=producto, cantidad='1', motivo='Compra')
        registrar_ajuste(usuario=self.usuario, producto=producto, cantidad='-2', motivo='Rotura')
        self.assertEqual(self._stock(producto), Decimal('8'))

    def test_venta_descuenta_con_signo_negativo_y_guarda_la_referencia(self):
        producto = self._producto(stock='10')
        movimientos = descontar_por_venta(
            usuario=self.usuario, lineas=[(producto, '3')], referencia='venta:55'
        )
        self.assertEqual(self._stock(producto), Decimal('7'))
        self.assertEqual(movimientos[0].cantidad, Decimal('-3'))
        self.assertEqual(movimientos[0].stock_resultante, Decimal('7'))
        self.assertEqual(movimientos[0].referencia_origen, 'venta:55')

    def test_stock_insuficiente_no_cambia_nada(self):
        producto = self._producto(stock='2')
        with self.assertRaises(StockInsuficienteError) as contexto:
            descontar_por_venta(usuario=self.usuario, lineas=[(producto, '3')])
        self.assertEqual(contexto.exception.disponible, Decimal('2'))
        self.assertEqual(self._stock(producto), Decimal('2'))
        self.assertEqual(MovimientoStock.objects.count(), 0)

    def test_el_mismo_producto_repetido_se_suma_antes_de_validar(self):
        producto = self._producto(stock='3')
        with self.assertRaises(StockInsuficienteError):
            descontar_por_venta(usuario=self.usuario, lineas=[(producto, '2'), (producto, '2')])
        self.assertEqual(self._stock(producto), Decimal('3'))

        movimientos = descontar_por_venta(
            usuario=self.usuario, lineas=[(producto, '1'), (producto, '2')]
        )
        self.assertEqual(len(movimientos), 1)
        self.assertEqual(movimientos[0].cantidad, Decimal('-3'))
        self.assertEqual(self._stock(producto), Decimal('0'))

    def test_todo_o_nada_si_una_linea_falla_ninguna_se_aplica(self):
        alcanza = self._producto('Alcanza', stock='10')
        no_alcanza = self._producto('No alcanza', stock='1')
        with self.assertRaises(StockInsuficienteError):
            descontar_por_venta(
                usuario=self.usuario, lineas=[(alcanza, '4'), (no_alcanza, '2')]
            )
        self.assertEqual(self._stock(alcanza), Decimal('10'))
        self.assertEqual(self._stock(no_alcanza), Decimal('1'))
        self.assertEqual(MovimientoStock.objects.count(), 0)

    def test_un_producto_desactivado_se_vende_mientras_tenga_stock(self):
        producto = self._producto(stock='2', activo=False)
        descontar_por_venta(usuario=self.usuario, lineas=[(producto, '2')])
        self.assertEqual(self._stock(producto), Decimal('0'))
        with self.assertRaises(StockInsuficienteError):
            descontar_por_venta(usuario=self.usuario, lineas=[(producto, '1')])

    def test_la_anulacion_repone_incluso_en_un_producto_desactivado(self):
        producto = self._producto(stock='0', activo=False)
        movimientos = reponer_por_anulacion(
            usuario=self.usuario, lineas=[(producto, '2')], referencia='venta:55'
        )
        self.assertEqual(self._stock(producto), Decimal('2'))
        self.assertEqual(movimientos[0].tipo, 'anulacion_venta')
        self.assertEqual(movimientos[0].cantidad, Decimal('2'))

    def test_ajuste_positivo_negativo_y_que_no_deja_stock_negativo(self):
        producto = self._producto(stock='5')
        registrar_ajuste(usuario=self.usuario, producto=producto, cantidad='2', motivo='Conteo')
        registrar_ajuste(usuario=self.usuario, producto=producto, cantidad='-3', motivo='Rotura')
        self.assertEqual(self._stock(producto), Decimal('4'))
        with self.assertRaises(StockInsuficienteError):
            registrar_ajuste(usuario=self.usuario, producto=producto, cantidad='-5', motivo='Error')
        with self.assertRaises(StockError):
            registrar_ajuste(usuario=self.usuario, producto=producto, cantidad='0', motivo='Nada')

    def test_la_unidad_decide_si_se_admiten_decimales(self):
        por_unidad = self._producto('Alfajor', stock='10', unidad=self.unidad)
        por_kilo = self._producto('Pan', stock='5', unidad=self.kilo)
        with self.assertRaises(StockError):
            descontar_por_venta(usuario=self.usuario, lineas=[(por_unidad, '1.5')])
        descontar_por_venta(usuario=self.usuario, lineas=[(por_kilo, '1.250')])
        self.assertEqual(self._stock(por_kilo), Decimal('3.750'))

    def test_las_cuentas_cierran_stock_igual_a_la_suma_de_movimientos(self):
        producto = self._producto(stock='0')
        registrar_ingreso(usuario=self.usuario, producto=producto, cantidad='20', motivo='Compra')
        descontar_por_venta(usuario=self.usuario, lineas=[(producto, '6')], referencia='venta:1')
        registrar_ajuste(usuario=self.usuario, producto=producto, cantidad='-1', motivo='Rotura')
        reponer_por_anulacion(usuario=self.usuario, lineas=[(producto, '6')], referencia='venta:1')

        total = MovimientoStock.objects.filter(producto=producto).aggregate(t=Sum('cantidad'))['t']
        ultimo = MovimientoStock.objects.filter(producto=producto).order_by('id').last()
        self.assertEqual(self._stock(producto), Decimal('19'))
        self.assertEqual(total, Decimal('19'))
        self.assertEqual(ultimo.stock_resultante, Decimal('19'))

    def test_los_movimientos_son_inmutables(self):
        producto = self._producto()
        movimiento = registrar_ingreso(
            usuario=self.usuario, producto=producto, cantidad='1', motivo='Compra'
        )
        movimiento.motivo = 'Otro'
        with self.assertRaises(RegistroInmutableError):
            movimiento.save()
        with self.assertRaises(RegistroInmutableError):
            movimiento.delete()
        with self.assertRaises(RegistroInmutableError):
            MovimientoStock.objects.update(motivo='Otro')
        with self.assertRaises(RegistroInmutableError):
            MovimientoStock.objects.all().delete()

    def test_la_base_rechaza_movimientos_con_signo_o_motivo_invalidos(self):
        producto = self._producto()
        casos = (
            dict(tipo='venta', cantidad=Decimal('1'), motivo=''),
            dict(tipo='ingreso', cantidad=Decimal('-1'), motivo='Compra'),
            dict(tipo='ajuste', cantidad=Decimal('0'), motivo='Nada'),
            dict(tipo='ingreso', cantidad=Decimal('1'), motivo=''),
        )
        for caso in casos:
            with self.subTest(caso=caso):
                with self.assertRaises(IntegrityError):
                    with transaction.atomic():
                        MovimientoStock.objects.create(
                            producto=producto, usuario=self.usuario,
                            stock_resultante=Decimal('1'), **caso,
                        )

    def test_el_servicio_bloquea_solo_las_filas_de_los_productos(self):
        producto = self._producto()
        with CaptureQueriesContext(connection) as consultas:
            descontar_por_venta(usuario=self.usuario, lineas=[(producto, '1')])
        bloqueo = [c['sql'] for c in consultas if 'FOR UPDATE' in c['sql']]
        self.assertEqual(len(bloqueo), 1)
        self.assertIn('FOR UPDATE OF "productos_producto"', bloqueo[0])
        self.assertIn('ORDER BY "productos_producto"."id"', bloqueo[0])


class ConcurrenciaDeStockTests(TransactionTestCase):
    """Pruebas con hilos y transacciones reales (cada hilo tiene su propia conexión)."""

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        self.categoria = Categoria.objects.create(nombre='Bebidas')
        self.unidad = UnidadMedida.objects.get(abreviatura='u')

    def _fixture_teardown(self):
        # El vaciado por defecto usa TRUNCATE, que el trigger de auditoría rechaza
        # y que además borraría los roles y unidades cargados por migración.
        with connection.cursor() as cursor:
            cursor.execute('DELETE FROM stock_movimientostock')
        Producto.objects.all().delete()
        Categoria.objects.all().delete()
        Usuario.objects.all().delete()

    def _producto(self, nombre, stock):
        return Producto.objects.create(
            nombre=nombre, precio=Decimal('100'), stock=Decimal(stock),
            categoria=self.categoria, unidad=self.unidad,
        )

    def _correr_en_hilos(self, tareas):
        resultados = [None] * len(tareas)
        arranque = threading.Barrier(len(tareas))

        def ejecutar(indice, tarea):
            try:
                arranque.wait()
                resultados[indice] = tarea()
            except Exception as error:  # se informa en el hilo principal
                resultados[indice] = error
            finally:
                connections.close_all()

        hilos = [
            threading.Thread(target=ejecutar, args=(i, tarea)) for i, tarea in enumerate(tareas)
        ]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()
        return resultados

    def test_diez_ventas_simultaneas_con_stock_para_tres_aceptan_exactamente_tres(self):
        producto = self._producto('Gaseosa', '3')

        def vender():
            return descontar_por_venta(
                usuario=self.usuario, lineas=[(producto, '1')], referencia='venta:prueba'
            )

        resultados = self._correr_en_hilos([vender] * 10)

        exitos = [r for r in resultados if isinstance(r, list)]
        rechazos = [r for r in resultados if isinstance(r, StockInsuficienteError)]
        self.assertEqual(len(exitos) + len(rechazos), 10, resultados)
        self.assertEqual(len(exitos), 3)
        self.assertEqual(len(rechazos), 7)
        self.assertEqual(Producto.objects.get(pk=producto.pk).stock, Decimal('0'))
        self.assertEqual(MovimientoStock.objects.filter(producto=producto).count(), 3)

    def test_ventas_cruzadas_en_orden_opuesto_no_se_traban_ni_pierden_stock(self):
        a = self._producto('A', '100')
        b = self._producto('B', '100')

        def vender_en_orden(orden):
            def tarea():
                for _ in range(20):
                    descontar_por_venta(
                        usuario=self.usuario, lineas=[(p, '1') for p in orden]
                    )
            return tarea

        resultados = self._correr_en_hilos([vender_en_orden((a, b)), vender_en_orden((b, a))])

        self.assertEqual(resultados, [None, None])
        self.assertEqual(Producto.objects.get(pk=a.pk).stock, Decimal('60'))
        self.assertEqual(Producto.objects.get(pk=b.pk).stock, Decimal('60'))
        self.assertEqual(MovimientoStock.objects.count(), 80)
