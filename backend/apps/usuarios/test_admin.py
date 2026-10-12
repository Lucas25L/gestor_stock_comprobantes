from django.test import TestCase

from .models import Usuario


class PantallasDelAdminTests(TestCase):
    def test_las_pantallas_del_admin_cargan(self):
        Usuario.objects.create_superuser(username='su', password='clave-de-prueba-123')
        self.client.login(username='su', password='clave-de-prueba-123')
        for ruta in (
            '/admin/usuarios/usuario/',
            '/admin/usuarios/usuario/add/',
            '/admin/usuarios/rol/',
            '/admin/auditoria/auditoria/',
            '/admin/productos/producto/',
            '/admin/stock/movimientostock/',
            '/admin/mediospago/mediopago/',
            '/admin/ventas/venta/',
            '/admin/comprobantes/comprobante/',
        ):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 200)
