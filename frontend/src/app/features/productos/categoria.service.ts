import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Categoria } from './categoria.model';

@Injectable({
    providedIn: 'root'
})
export class CategoriaService {
    private http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/categorias/`;

    private categoriasState = signal<Categoria[]>([]);
    public categorias = this.categoriasState.asReadonly();

    cargarCategorias(): Observable<Categoria[]> {
        return this.http.get<Categoria[]>(this.baseUrl).pipe(
            tap((categorias) => this.categoriasState.set(categorias))
        );
    }
}