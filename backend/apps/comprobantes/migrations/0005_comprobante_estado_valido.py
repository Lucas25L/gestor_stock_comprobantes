from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('comprobantes', '0004_completar_comprobantes_existentes')]

    operations = [
        migrations.AddConstraint(
            model_name='comprobante',
            constraint=models.CheckConstraint(
                condition=models.Q(('estado__in', ('emitido', 'anulado'))),
                name='comprobante_estado_valido',
            ),
        ),
    ]
