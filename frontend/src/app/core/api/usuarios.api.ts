import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { UsuarioListado } from './modelos';

/** Solo el Administrador puede consultar usuarios: el resto recibe 403. */
@Injectable({ providedIn: 'root' })
export class UsuariosApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/usuarios/`;

    /** Todos los usuarios, activos e inactivos. El listado no está paginado. */
    listar(): Observable<UsuarioListado[]> {
        return this.http.get<UsuarioListado[]>(this.url);
    }
}
