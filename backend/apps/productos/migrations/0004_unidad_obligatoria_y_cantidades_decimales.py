import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0003_asignar_unidad_inicial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='producto',
            name='unidad',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='productos',
                to='unidades.unidadmedida',
            ),
        ),
        migrations.AlterField(
            model_name='producto',
            name='stock',
            field=models.DecimalField(decimal_places=3, default=0, max_digits=12),
        ),
        migrations.AlterField(
            model_name='producto',
            name='stock_minimo',
            field=models.DecimalField(decimal_places=3, default=0, max_digits=12),
        ),
        migrations.AddConstraint(
            model_name='producto',
            constraint=models.CheckConstraint(
                condition=models.Q(('stock__gte', 0)), name='producto_stock_no_negativo'
            ),
        ),
        migrations.AddConstraint(
            model_name='producto',
            constraint=models.CheckConstraint(
                condition=models.Q(('stock_minimo__gte', 0)), name='producto_stock_minimo_no_negativo'
            ),
        ),
    ]