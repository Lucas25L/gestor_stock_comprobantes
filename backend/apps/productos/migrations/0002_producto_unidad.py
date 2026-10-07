import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0001_initial'),
        ('unidades', '0003_permite_decimales'),
    ]

    operations = [
        migrations.AddField(
            model_name='producto',
            name='unidad',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='productos',
                to='unidades.unidadmedida',
            ),
        ),
    ]