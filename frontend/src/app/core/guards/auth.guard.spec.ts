import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { UrlTree } from '@angular/router';

describe('authGuard', () => {
    let authServiceMock: any;
    let routerMock: any;

    beforeEach(() => {
        authServiceMock = {
            estaAutenticado: vi.fn() // Usamos las utilidades nativas de Vitest (vi)
        };
        routerMock = {
            createUrlTree: vi.fn().mockReturnValue({} as UrlTree)
        };

        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: authServiceMock },
                { provide: Router, useValue: routerMock }
            ]
            });
    });

    it('debería permitir el acceso si el usuario está autenticado', () => {
        authServiceMock.estaAutenticado.mockReturnValue(true);
        
        // Ejecutamos el guard funcional en el contexto de inyección de TestBed
        const resultado = TestBed.runInInjectionContext(() => 
        authGuard({} as any, {} as any)
        );

        expect(resultado).toBe(true);
    });

    it('debería redirigir al login si el usuario NO está autenticado', () => {
        authServiceMock.estaAutenticado.mockReturnValue(false);

        TestBed.runInInjectionContext(() => 
        authGuard({} as any, {} as any)
        );

        expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login']);
    });
});