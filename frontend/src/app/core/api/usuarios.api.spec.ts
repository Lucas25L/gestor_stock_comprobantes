import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { UsuarioListado } from './modelos';
import { UsuariosApi } from './usuarios.api';

const lucas: UsuarioListado = {
    id: 1,
    username: 'Lucas_Lopez',
    email: '',
    first_name: 'Lucas',
    last_name: 'López',
    rol: 1,
    rol_nombre: 'Administrador',
    is_active: true,
    date_joined: '2026-10-01T10:00:00-03:00',
};

describe('UsuariosApi', () => {
    const URL = `${environment.apiUrl}/usuarios/`;
    let api: UsuariosApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        api = TestBed.inject(UsuariosApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('lista los usuarios con GET y sin parámetros', () => {
        let recibidos: UsuarioListado[] = [];
        api.listar().subscribe((usuarios) => (recibidos = usuarios));

        const peticion = http.expectOne(URL);
        expect(peticion.request.method).toBe('GET');
        expect(peticion.request.params.keys()).toEqual([]);
        peticion.flush([lucas]);

        expect(recibidos).toEqual([lucas]);
    });

    it('propaga el 403 cuando el usuario no es Administrador', () => {
        let estado: number | null = null;
        api.listar().subscribe({
            error: (error: HttpErrorResponse) => (estado = error.status),
        });

        http.expectOne(URL).flush({ detail: 'No autorizado.' }, { status: 403, statusText: 'Forbidden' });

        expect(estado).toBe(403);
    });
});
