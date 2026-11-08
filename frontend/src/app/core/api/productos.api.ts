import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { DatosProducto, Producto } from './modelos';

export interface FiltrosProductos {
    search?: string;
    categoria?: number;
    unidad?: number;
    activo?: boolean;
    stock_bajo?: boolean;
    precio_min?: string;
    precio_max?: string;
    stock_min?: string;
    stock_max?: string;
    /** El listado oculta los desactivados salvo que se pidan (en productos es "inactivos", en masculino). */
    incluir_inactivos?: boolean;
    ordering?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductosApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/productos/`;

    /** Por defecto trae solo los productos activos. El listado no está paginado. */
    listar(filtros: FiltrosProductos = {}): Observable<Producto[]> {
        return this.http.get<Producto[]>(this.url, { params: aParams(filtros) });
    }

    /** Lista de reposición: stock menor o igual al mínimo, de mayor a menor faltante. */
    stockBajo(): Observable<Producto[]> {
        return this.http.get<Producto[]>(`${this.url}stock-bajo/`);
    }

    /** Solo el Administrador. El stock inicial se carga después con un ingreso. */
    crear(datos: DatosProducto): Observable<Producto> {
        return this.http.post<Producto>(this.url, datos);
    }

    /** Solo el Administrador. Edición parcial: se envían únicamente los campos que cambian. */
    actualizar(id: number, cambios: Partial<DatosProducto>): Observable<Producto> {
        return this.http.patch<Producto>(`${this.url}${id}/`, cambios);
    }

    /** Baja lógica: el producto se conserva y sus ventas históricas no cambian. */
    desactivar(id: number): Observable<void> {
        return this.http.delete<void>(`${this.url}${id}/`);
    }

    reactivar(id: number): Observable<Producto> {
        return this.http.post<Producto>(`${this.url}${id}/reactivar/`, {});
    }
}
