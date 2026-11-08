import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { Producto } from './modelos';

export interface FiltrosProductos {
    search?: string;
    unidad?: number;
    stock_bajo?: boolean;
    incluir_inactivos?: boolean;
    ordering?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductosApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/productos/`;

    /** Por defecto trae solo los productos activos. */
    listar(filtros: FiltrosProductos = {}): Observable<Producto[]> {
        return this.http.get<Producto[]>(this.url, { params: aParams(filtros) });
    }

    /** Lista de reposición: stock menor o igual al mínimo, de mayor a menor faltante. */
    stockBajo(): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.url}stock-bajo/`);
    }
}
