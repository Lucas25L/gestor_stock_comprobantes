from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="MedioPago",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("nombre", models.CharField(max_length=50, unique=True)),
                ("descripcion", models.CharField(blank=True, max_length=255)),
                ("activo", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Medio de pago",
                "verbose_name_plural": "Medios de pago",
                "ordering": ("nombre",),
            },
        ),
    ]
