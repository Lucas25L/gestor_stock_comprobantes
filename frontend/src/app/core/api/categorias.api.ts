import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import { Categoria, DatosCategoria } from './modelos';

export interface FiltrosCategorias {
    search?: string;
    /** El listado oculta las desactivadas salvo que se pidan (en categorías es "inactivas", en femenino). */
    incluir_inactivas?: boolean;
    ordering?: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriasApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/categorias/`;

    /** Lo pueden consultar los tres roles. */
    listar(filtros: FiltrosCategorias = {}): Observable<Categoria[]> {
        return this.http.get<Categoria[]>(this.url, { params: aParams(filtros) });
    }

    /** Alta, edición, baja y reactivación: solo el Administrador. */
    crear(datos: DatosCategoria): Observable<Categoria> {
        return this.http.post<Categoria>(this.url, datos);
    }

    actualizar(id: number, cambios: Partial<DatosCategoria>): Observable<Categoria> {
        return this.http.patch<Categoria>(`${this.url}${id}/`, cambios);
    }

    desactivar(id: number): Observable<void> {
        return this.http.delete<void>(`${this.url}${id}/`);
    }

    reactivar(id: number): Observable<Categoria> {
        return this.http.post<Categoria>(`${this.url}${id}/reactivar/`, {});
    }
}
