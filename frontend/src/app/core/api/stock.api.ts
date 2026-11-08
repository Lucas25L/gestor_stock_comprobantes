import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { MovimientoStock, NuevoAjuste, NuevoIngreso, Pagina, TipoMovimiento } from './modelos';

export interface FiltrosMovimientos {
    producto?: number;
    usuario?: number;
    tipo?: TipoMovimiento;
    referencia?: string;
    /** Día calendario AAAA-MM-DD en hora local de Argentina. */
    desde?: string;
    hasta?: string;
    search?: string;
    ordering?: string;
    page?: number;
    page_size?: number;
}

/** Ingresos, ajustes y movimientos de stock: solo Administrador y Repositor. */
@Injectable({ providedIn: 'root' })
export class StockApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/stock/`;

    ingresar(ingreso: NuevoIngreso): Observable<MovimientoStock> {
        return this.http.post<MovimientoStock>(`${this.url}ingresos/`, ingreso);
    }

    ajustar(ajuste: NuevoAjuste): Observable<MovimientoStock> {
        return this.http.post<MovimientoStock>(`${this.url}ajustes/`, ajuste);
    }

    /** Historial inmutable de movimientos, paginado de a 50 por defecto. */
    movimientos(filtros: FiltrosMovimientos = {}): Observable<Pagina<MovimientoStock>> {
        return this.http.get<Pagina<MovimientoStock>>(`${this.url}movimientos/`, {
            params: aParams(filtros),
        });
    }
}
