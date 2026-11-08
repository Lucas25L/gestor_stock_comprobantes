import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { DatosUnidad, UnidadMedida } from './modelos';

export interface FiltrosUnidades {
    search?: string;
    permite_decimales?: boolean;
    /** El listado oculta las desactivadas salvo que se pidan (en unidades es "inactivas", en femenino). */
    incluir_inactivas?: boolean;
    ordering?: string;
}

@Injectable({ providedIn: 'root' })
export class UnidadesApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/unidades/`;

    /** Lo pueden consultar los tres roles. */
    listar(filtros: FiltrosUnidades = {}): Observable<UnidadMedida[]> {
        return this.http.get<UnidadMedida[]>(this.url, { params: aParams(filtros) });
    }

    /** Alta, edición, baja y reactivación: solo el Administrador. */
    crear(datos: DatosUnidad): Observable<UnidadMedida> {
        return this.http.post<UnidadMedida>(this.url, datos);
    }

    actualizar(id: number, cambios: Partial<DatosUnidad>): Observable<UnidadMedida> {
        return this.http.patch<UnidadMedida>(`${this.url}${id}/`, cambios);
    }

    /** El backend la rechaza (400) si la usan productos activos. */
    desactivar(id: number): Observable<void> {
        return this.http.delete<void>(`${this.url}${id}/`);
    }

    reactivar(id: number): Observable<UnidadMedida> {
        return this.http.post<UnidadMedida>(`${this.url}${id}/reactivar/`, {});
    }
}
