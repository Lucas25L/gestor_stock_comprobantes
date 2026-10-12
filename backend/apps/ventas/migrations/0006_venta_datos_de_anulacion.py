import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0005_medio_pago_obligatorio'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='venta',
            name='motivo_anulacion',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='venta',
            name='anulada_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='ventas_anuladas',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='venta',
            name='fecha_anulacion',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
