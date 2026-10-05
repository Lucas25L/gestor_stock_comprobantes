from .models import Auditoria


def registrar(*, usuario, accion, entidad, id_registro=None, detalle=None):
    """Crea un registro de auditoría.

    Debe llamarse dentro de la misma transacción que la operación auditada,
    para que ambas se confirmen o se deshagan juntas.
    """
    return Auditoria.objects.create(
        usuario=usuario,
        accion=accion,
        entidad=entidad,
        id_registro_afectado=id_registro,
        detalle=detalle or {},
    )