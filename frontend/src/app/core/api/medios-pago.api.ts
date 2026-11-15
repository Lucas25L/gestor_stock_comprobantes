import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { DatosMedioPago, MedioPago } from './modelos';

export interface FiltrosMediosPago {
    search?: string;
    /** El listado oculta los desactivados salvo que se pidan (en medios de pago es "inactivos", en masculino). */
    incluir_inactivos?: boolean;
    ordering?: string;
}

@Injectable({ providedIn: 'root' })
export class MediosPagoApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/medios-pago/`;

    /** Por defecto solo los activos (los puede consultar el Administrador y el Cajero). */
    listar(filtros: FiltrosMediosPago = {}): Observable<MedioPago[]> {
        return this.http.get<MedioPago[]>(this.url, { params: aParams(filtros) });
    }

    /** Alta, edición, baja y reactivación: solo el Administrador. */
    crear(datos: DatosMedioPago): Observable<MedioPago> {
        return this.http.post<MedioPago>(this.url, datos);
    }

    actualizar(id: number, cambios: Partial<DatosMedioPago>): Observable<MedioPago> {
        return this.http.patch<MedioPago>(`${this.url}${id}/`, cambios);
    }

    /** Baja lógica: las ventas ya registradas conservan su medio de pago. */
    desactivar(id: number): Observable<void> {
        return this.http.delete<void>(`${this.url}${id}/`);
    }

    reactivar(id: number): Observable<MedioPago> {
        return this.http.post<MedioPago>(`${this.url}${id}/reactivar/`, {});
    }
}
