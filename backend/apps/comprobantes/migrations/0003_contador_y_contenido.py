from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comprobantes', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContadorComprobante',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('clave', models.CharField(default='comprobante', max_length=30, unique=True)),
                ('ultimo_numero', models.PositiveIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'Contador de comprobantes',
                'verbose_name_plural': 'Contadores de comprobantes',
            },
        ),
        migrations.AddField(
            model_name='comprobante',
            name='contenido',
            field=models.JSONField(default=dict, editable=False),
        ),
    ]
