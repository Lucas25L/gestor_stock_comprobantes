import { HttpParams } from '@angular/common/http';

/** Convierte un objeto de filtros en parámetros de URL, omitiendo los vacíos. */
export function aParams(filtros: object = {}): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
        if (valor === undefined || valor === null || valor === '') {
            continue;
        }
        params = params.set(clave, String(valor));
    }
    return params;
}
