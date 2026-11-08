import { HttpErrorResponse } from '@angular/common/http';

const MENSAJE_POR_DEFECTO = 'Ocurrió un error inesperado. Intentá de nuevo.';

function aplanar(valor: unknown): string[] {
    if (typeof valor === 'string') {
        // Una página de error en HTML (por ejemplo un 404 de Django) no se le muestra al usuario.
        return valor.trimStart().startsWith('<') ? [] : [valor];
    }
    if (Array.isArray(valor)) {
        return valor.flatMap(aplanar);
    }
    if (valor !== null && typeof valor === 'object') {
        return Object.values(valor).flatMap(aplanar);
    }
    return [];
}

/**
 * Convierte un error HTTP en un mensaje para el usuario. Los 400 muestran lo que
 * informó el backend (DRF devuelve {detail}, {campo: [...]}, etc.); el resto, un texto fijo.
 */
export function mensajeDeError(error: unknown, porDefecto: string = MENSAJE_POR_DEFECTO): string {
    if (!(error instanceof HttpErrorResponse)) {
        return porDefecto;
    }
    if (error.status === 0) {
        return 'No se pudo conectar con el servidor. Verificá la conexión.';
    }
    if (error.status === 403) {
        return 'No tenés permisos para realizar esta acción.';
    }
    if (error.status >= 500) {
        return 'El servidor tuvo un problema. Intentá de nuevo en unos minutos.';
    }
    const mensajes = aplanar(error.error);
    return mensajes.length > 0 ? mensajes.join(' ') : porDefecto;
}
