import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { Usuario } from '../models/usuario.model';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    #accessToken = signal<string | null>(null);
    #usuarioState = signal<Usuario | null>(null);

    usuarioActual = this.#usuarioState.asReadonly();
    estaAutenticado = computed(() => this.#usuarioState() !== null);

    constructor(
        private router: Router,
        private http: HttpClient
    ) {}

    login(credenciales: LoginRequestDto): Observable<AuthResponseDto> {
        return this.http.post<AuthResponseDto>(
            `${environment.apiUrl}/token/`,
            credenciales,
            { withCredentials: true }
        ).pipe(
            tap((respuesta) => {
                this.#accessToken.set(respuesta.access);
                this.#usuarioState.set(respuesta.usuario);
            })
        );
    }

    logout(): void {
        this.#accessToken.set(null);
        this.#usuarioState.set(null);
        this.router.navigate(['/login']);
        // Nota: la cookie del refresh la limpia el backend en un endpoint de logout (paso pendiente)
    }

    obtenerToken(): string | null {
        return this.#accessToken();
    }

    actualizarAccessToken(token: string): void {
        this.#accessToken.set(token);
    }

    /* método de refresh silencioso */
    refrescarSesion(): Observable<AuthResponseDto> {
        return this.http.post<AuthResponseDto>(
            `${environment.apiUrl}/token/refresh/`,
            {},
            { withCredentials: true }
        ).pipe(
            tap((respuesta) => {
                this.#accessToken.set(respuesta.access);
                this.#usuarioState.set(respuesta.usuario);
            })
        );
    }
}