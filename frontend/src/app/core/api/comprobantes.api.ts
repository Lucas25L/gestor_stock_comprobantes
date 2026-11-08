import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { Comprobante } from './modelos';

export interface FiltrosComprobantes {
    estado?: 'emitido' | 'anulado';
    numero?: number;
    numero_desde?: number;
    numero_hasta?: number;
    venta?: number;
    desde?: string;
    hasta?: string;
    ordering?: string;
}

@Injectable({ providedIn: 'root' })
export class ComprobantesApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/comprobantes/`;

    listar(filtros: FiltrosComprobantes = {}): Observable<Comprobante[]> {
        return this.http.get<Comprobante[]>(this.url, { params: aParams(filtros) });
    }

    obtener(id: number): Observable<Comprobante> {
        return this.http.get<Comprobante>(`${this.url}${id}/`);
    }

    /** Emite, a pedido, el comprobante de una venta (numeración correlativa en el backend). */
    emitir(venta: number): Observable<Comprobante> {
        return this.http.post<Comprobante>(this.url, { venta });
    }
}
