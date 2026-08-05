import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Evaluamos el Signal de autenticación de manera imperativa en el momento de la transición
    if (authService.estaAutenticado()) {
        return true;
    }

    // Si no está autenticado, lo mandamos al login guardando la URL de intento (opcional)
    return router.createUrlTree(['/login']);
};