from django.db import migrations, models


def marcar_unidades_con_decimales(apps, schema_editor):
    UnidadMedida = apps.get_model('unidades', 'UnidadMedida')
    UnidadMedida.objects.filter(abreviatura__in=('kg', 'l')).update(permite_decimales=True)


class Migration(migrations.Migration):

    dependencies = [
        ('unidades', '0002_cargar_unidades_iniciales'),
    ]

    operations = [
        migrations.AddField(
            model_name='unidadmedida',
            name='permite_decimales',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(marcar_unidades_con_decimales, migrations.RunPython.noop),
    ]