import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0004_asignar_medio_pago_inicial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='venta',
            name='medio_pago',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='ventas',
                to='mediospago.mediopago',
            ),
        ),
    ]
