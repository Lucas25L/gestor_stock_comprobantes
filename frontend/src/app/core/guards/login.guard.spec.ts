import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { loginGuard } from './login.guard';
import { AuthService } from '../services/auth.service';

describe('loginGuard', () => {
    let authServiceMock: any;
    let routerMock: any;
    const urlDashboard = {} as UrlTree;

    beforeEach(() => {
        authServiceMock = {
            estaAutenticado: vi.fn()
        };
        routerMock = {
            createUrlTree: vi.fn().mockReturnValue(urlDashboard)
        };

        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authServiceMock },
                { provide: Router, useValue: routerMock }
            ]
        });
    });

    it('debería permitir ver el login si NO hay sesión', () => {
        authServiceMock.estaAutenticado.mockReturnValue(false);

        const resultado = TestBed.runInInjectionContext(() =>
            loginGuard({} as any, {} as any)
        );

        expect(resultado).toBe(true);
        expect(routerMock.createUrlTree).not.toHaveBeenCalled();
    });

    it('debería redirigir al dashboard si ya hay una sesión activa', () => {
        authServiceMock.estaAutenticado.mockReturnValue(true);

        const resultado = TestBed.runInInjectionContext(() =>
            loginGuard({} as any, {} as any)
        );

        expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
        expect(resultado).toBe(urlDashboard);
    });
});
