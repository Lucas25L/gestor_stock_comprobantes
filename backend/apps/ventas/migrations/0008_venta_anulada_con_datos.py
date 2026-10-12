from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('ventas', '0007_completar_ventas_ya_anuladas')]

    operations = [
        migrations.AddConstraint(
            model_name='venta',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ('activa', True),
                    models.Q(
                        models.Q(('motivo_anulacion', ''), _negated=True),
                        ('anulada_por__isnull', False),
                        ('fecha_anulacion__isnull', False),
                    ),
                    _connector='OR',
                ),
                name='venta_anulada_con_datos',
            ),
        ),
    ]
