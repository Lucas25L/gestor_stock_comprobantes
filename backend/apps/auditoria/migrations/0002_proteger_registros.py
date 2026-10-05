from django.db import migrations

CREAR_PROTECCION = """
CREATE OR REPLACE FUNCTION auditoria_bloquear_cambios() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoria no pueden modificarse ni eliminarse.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_sin_update_delete
BEFORE UPDATE OR DELETE ON auditoria_auditoria
FOR EACH ROW EXECUTE FUNCTION auditoria_bloquear_cambios();

CREATE TRIGGER auditoria_sin_truncate
BEFORE TRUNCATE ON auditoria_auditoria
FOR EACH STATEMENT EXECUTE FUNCTION auditoria_bloquear_cambios();
"""

QUITAR_PROTECCION = """
DROP TRIGGER IF EXISTS auditoria_sin_truncate ON auditoria_auditoria;
DROP TRIGGER IF EXISTS auditoria_sin_update_delete ON auditoria_auditoria;
DROP FUNCTION IF EXISTS auditoria_bloquear_cambios();
"""


def crear_proteccion(apps, schema_editor):
    # Los triggers son propios de PostgreSQL; en otros motores solo rige la
    # protección a nivel de aplicación (modelo y queryset).
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(CREAR_PROTECCION, params=None)


def quitar_proteccion(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(QUITAR_PROTECCION, params=None)


class Migration(migrations.Migration):
    dependencies = [('auditoria', '0001_initial')]
    operations = [migrations.RunPython(crear_proteccion, quitar_proteccion)]