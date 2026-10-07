from django.db import migrations


def asignar_unidad_inicial(apps, schema_editor):
    Producto = apps.get_model('productos', 'Producto')
    UnidadMedida = apps.get_model('unidades', 'UnidadMedida')
    sin_unidad = Producto.objects.filter(unidad__isnull=True)
    if sin_unidad.exists():
        sin_unidad.update(unidad=UnidadMedida.objects.get(abreviatura='u'))


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0002_producto_unidad'),
        ('unidades', '0002_cargar_unidades_iniciales'),
    ]

    operations = [
        migrations.RunPython(asignar_unidad_inicial, migrations.RunPython.noop),
    ]