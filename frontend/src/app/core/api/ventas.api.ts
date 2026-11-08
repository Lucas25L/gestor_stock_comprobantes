import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { NuevaVenta, Venta } from './modelos';

export interface FiltrosVentas {
    /** Día calendario AAAA-MM-DD en hora local de Argentina. */
    desde?: string;
    hasta?: string;
    medio_pago?: number;
    usuario?: number;
    total_min?: string;
    total_max?: string;
    /** El listado oculta las anuladas salvo que se pidan. */
    incluir_inactivas?: boolean;
    search?: string;
    ordering?: string;
}

@Injectable({ providedIn: 'root' })
export class VentasApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/ventas/`;

    /** El listado NO está paginado: conviene siempre acotarlo con fechas. */
    listar(filtros: FiltrosVentas = {}): Observable<Venta[]> {
        return this.http.get<Venta[]>(this.url, { params: aParams(filtros) });
    }

    obtener(id: number): Observable<Venta> {
        return this.http.get<Venta>(`${this.url}${id}/`);
    }

    /** Registra la venta y descuenta el stock. No emite comprobante. */
    crear(venta: NuevaVenta): Observable<Venta> {
        return this.http.post<Venta>(this.url, venta);
    }

    /** Anula la venta, repone el stock y exige un motivo. */
    anular(id: number, motivo: string): Observable<Venta> {
        return this.http.post<Venta>(`${this.url}${id}/anular/`, { motivo });
    }
}
