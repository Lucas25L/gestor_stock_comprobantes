import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';

import { Usuario } from '../models/usuario.model';
import { Rol } from '../models/rol';
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
    rol = computed<Rol | null>(() => this.#usuarioState()?.rol ?? null);

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
            tap((respuesta) => this.#guardarSesion(respuesta))
        );
    }

    /** Cierra la sesión: invalida el refresh token en el backend y limpia el estado local. */
    logout(): void {
        this.http.post(
            `${environment.apiUrl}/logout/`,
            {},
            { withCredentials: true }
        ).pipe(
            // Aunque el backend falle (red caída, token vencido), la sesión local se cierra igual.
            catchError(() => of(null))
        ).subscribe(() => this.cerrarSesionLocal());
    }

    /** Solo limpia el estado y vuelve al login. No llama al backend (lo usa el interceptor). */
    cerrarSesionLocal(): void {
        this.#accessToken.set(null);
        this.#usuarioState.set(null);
        this.router.navigate(['/login']);
    }

    tieneRol(permitidos: readonly Rol[]): boolean {
        const actual = this.rol();
        return actual !== null && permitidos.includes(actual);
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
            tap((respuesta) => this.#guardarSesion(respuesta))
        );
    }

    #guardarSesion(respuesta: AuthResponseDto): void {
        this.#accessToken.set(respuesta.access);
        this.#usuarioState.set(respuesta.usuario);
    }
}
