import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege /login: si ya hay una sesión activa, no tiene sentido mostrar el
 * formulario, así que se redirige al inicio. La sesión ya fue restaurada por
 * initAuth antes de resolver la ruta, por eso alcanza con leer el Signal.
 */
export const loginGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.estaAutenticado()) {
        return router.createUrlTree(['/dashboard']);
    }

    return true;
};
