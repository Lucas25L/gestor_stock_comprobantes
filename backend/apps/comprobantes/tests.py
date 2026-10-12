from decimal import Decimal
from unittest import mock

from django.db import DatabaseError, IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from apps.auditoria.models import Auditoria, RegistroInmutableError
from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Comprobante, ContadorComprobante


class EmisionDeComprobantesTests(TestCase):
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
        categoria = Categoria.objects.create(nombre='Almacén')
        cls.efectivo = MedioPago.objects.get(nombre='Efectivo')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('50'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000.00'), stock=Decimal('50.000'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='kg'),
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)

    def _vender(self, *items):
        cuerpo = {
            'medio_pago': self.efectivo.pk,
            'items': [{'producto': p.pk, 'cantidad': c} for p, c in items],
        }
        respuesta = self.cliente.post('/api/ventas/', cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data['id']

    def _emitir(self, venta_id):
        return self.cliente.post('/api/comprobantes/', {'venta': venta_id}, format='json')

    def test_emitir_genera_numero_y_copia_los_datos_de_la_venta(self):
        venta_id = self._vender((self.gaseosa, '2'), (self.pan, '1.250'))
        respuesta = self._emitir(venta_id)
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['numero'], 1)
        self.assertEqual(respuesta.data['numero_formateado'], '00000001')
        self.assertEqual(respuesta.data['estado'], 'emitido')

        contenido = respuesta.data['contenido']
        self.assertEqual(contenido['venta_id'], venta_id)
        self.assertEqual(contenido['medio_pago'], 'Efectivo')
        self.assertEqual(contenido['registrada_por'], 'cajero')
        self.assertEqual(contenido['total'], '5500.00')
        self.assertEqual(len(contenido['lineas']), 2)
        self.assertEqual(
            contenido['lineas'][1],
            {
                'producto': 'Pan', 'unidad': 'kg', 'cantidad': '1.250',
                'precio_unitario': '2000.00', 'subtotal': '2500.00',
            },
        )
        self.assertIn('fecha_venta', contenido)

    def test_la_numeracion_es_correlativa(self):
        numeros = [self._emitir(self._vender((self.gaseosa, '1'))).data['numero'] for _ in range(3)]
        self.assertEqual(numeros, [1, 2, 3])

    def test_una_venta_anulada_no_tiene_comprobante_y_no_consume_numero(self):
        venta_anulada = self._vender((self.gaseosa, '1'))
        self.cliente.post(f'/api/ventas/{venta_anulada}/anular/', {'motivo': 'Error'}, format='json')
        respuesta = self._emitir(venta_anulada)
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('anulada', str(respuesta.data))

        otra = self._vender((self.gaseosa, '1'))
        self.assertEqual(self._emitir(otra).data['numero'], 1)

    def test_una_venta_no_puede_tener_dos_comprobantes_ni_gastar_otro_numero(self):
        venta_id = self._vender((self.gaseosa, '1'))
        self.assertEqual(self._emitir(venta_id).status_code, 201)
        respuesta = self._emitir(venta_id)
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya tiene un comprobante', str(respuesta.data))
        self.assertEqual(Comprobante.objects.count(), 1)
        self.assertEqual(self._emitir(self._vender((self.gaseosa, '1'))).data['numero'], 2)

    def test_venta_inexistente_o_sin_venta(self):
        self.assertEqual(self._emitir(999999).status_code, 400)
        respuesta = self.cliente.post('/api/comprobantes/', {}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('venta', respuesta.data)

    def test_el_comprobante_no_cambia_si_despues_se_modifica_el_catalogo(self):
        venta_id = self._vender((self.gaseosa, '2'))
        comprobante_id = self._emitir(venta_id).data['id']
        Producto.objects.filter(pk=self.gaseosa.pk).update(nombre='Gaseosa renombrada', precio=Decimal('9999'))

        contenido = self.cliente.get(f'/api/comprobantes/{comprobante_id}/').data['contenido']
        self.assertEqual(contenido['lineas'][0]['producto'], 'Gaseosa')
        self.assertEqual(contenido['lineas'][0]['precio_unitario'], '1500.00')
        self.assertEqual(contenido['total'], '3000.00')

    def test_la_emision_queda_auditada(self):
        venta_id = self._vender((self.gaseosa, '1'))
        comprobante_id = self._emitir(venta_id).data['id']
        registro = Auditoria.objects.get(accion=Auditoria.Accion.COMPROBANTE_EMITIDO)
        self.assertEqual(registro.usuario, self.cajero)
        self.assertEqual(registro.entidad, 'Comprobante')
        self.assertEqual(registro.id_registro_afectado, comprobante_id)
        self.assertEqual(registro.detalle, {'numero': '00000001', 'venta_id': venta_id})

    def test_si_falla_la_auditoria_no_se_emite_ni_se_consume_el_numero(self):
        venta_id = self._vender((self.gaseosa, '1'))
        with mock.patch('apps.comprobantes.services.registrar', side_effect=DatabaseError('falla simulada')):
            with self.assertRaises(DatabaseError):
                self._emitir(venta_id)
        self.assertFalse(Comprobante.objects.exists())
        self.assertEqual(ContadorComprobante.objects.get(clave='comprobante').ultimo_numero, 0)
        self.assertEqual(self._emitir(venta_id).data['numero'], 1)

    # --- Consulta ---
    def test_consulta_por_id_y_por_venta(self):
        v1 = self._vender((self.gaseosa, '1'))
        v2 = self._vender((self.gaseosa, '1'))
        c1 = self._emitir(v1).data['id']
        self._emitir(v2)

        self.assertEqual(self.cliente.get(f'/api/comprobantes/{c1}/').data['venta'], v1)
        self.assertEqual(len(self.cliente.get('/api/comprobantes/').data), 2)
        filtrados = self.cliente.get(f'/api/comprobantes/?venta={v1}').data
        self.assertEqual([c['id'] for c in filtrados], [c1])
        self.assertEqual(self.cliente.get('/api/comprobantes/?venta=abc').status_code, 400)

    def test_el_comprobante_no_se_modifica_ni_se_borra_por_la_api(self):
        comprobante_id = self._emitir(self._vender((self.gaseosa, '1'))).data['id']
        url = f'/api/comprobantes/{comprobante_id}/'
        for metodo in ('put', 'patch', 'delete'):
            with self.subTest(metodo=metodo):
                self.assertEqual(getattr(self.cliente, metodo)(url, {}, format='json').status_code, 405)

    def test_el_repositor_no_puede_emitir_ni_consultar(self):
        self.cliente.force_authenticate(user=self.repositor)
        self.assertEqual(self.cliente.get('/api/comprobantes/').status_code, 403)
        self.assertEqual(self._emitir(1).status_code, 403)


class InmutabilidadDelComprobanteTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        categoria = Categoria.objects.create(nombre='Almacén')
        producto = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('10'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cliente = APIClient()
        cliente.force_authenticate(user=cajero)
        venta = cliente.post(
            '/api/ventas/',
            {
                'medio_pago': MedioPago.objects.get(nombre='Efectivo').pk,
                'items': [{'producto': producto.pk, 'cantidad': '1'}],
            },
            format='json',
        ).data['id']
        cls.comprobante = Comprobante.objects.get(
            pk=cliente.post('/api/comprobantes/', {'venta': venta}, format='json').data['id']
        )

    def test_no_se_puede_cambiar_el_contenido_ni_el_numero(self):
        self.comprobante.numero = 99
        with self.assertRaises(RegistroInmutableError):
            self.comprobante.save()
        with self.assertRaises(RegistroInmutableError):
            self.comprobante.save(update_fields=['numero'])
        with self.assertRaises(RegistroInmutableError):
            self.comprobante.save(update_fields=['contenido'])
        with self.assertRaises(RegistroInmutableError):
            Comprobante.objects.filter(pk=self.comprobante.pk).update(numero=99)
        with self.assertRaises(RegistroInmutableError):
            Comprobante.objects.filter(pk=self.comprobante.pk).update(contenido={})

    def test_no_se_puede_borrar(self):
        with self.assertRaises(RegistroInmutableError):
            self.comprobante.delete()
        with self.assertRaises(RegistroInmutableError):
            Comprobante.objects.all().delete()
        self.assertEqual(Comprobante.objects.count(), 1)

    def test_el_estado_si_puede_cambiar(self):
        self.comprobante.estado = Comprobante.Estado.ANULADO
        self.comprobante.save(update_fields=['estado'])
        self.comprobante.refresh_from_db()
        self.assertEqual(self.comprobante.estado, 'anulado')

    def test_la_base_rechaza_un_estado_invalido(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Comprobante.objects.filter(pk=self.comprobante.pk).update(estado='cualquiera')
