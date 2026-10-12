import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0002_cantidades_decimales'),
        ('mediospago', '0002_cargar_medios_iniciales'),
    ]

    operations = [
        migrations.AddField(
            model_name='venta',
            name='medio_pago',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='ventas',
                to='mediospago.mediopago',
            ),
        ),
    ]
