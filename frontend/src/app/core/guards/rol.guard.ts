import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from '../models/rol';
import { AuthService } from '../services/auth.service';

/**
 * Permite el acceso solo a los roles declarados en `data: { roles: [...] }` de la ruta.
 * Si la ruta no declara roles, no deja pasar a nadie (se deniega por defecto).
 */
export const rolGuard: CanActivateFn = (route) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const permitidos = (route.data['roles'] ?? []) as readonly Rol[];
    if (authService.tieneRol(permitidos)) {
        return true;
    }
    return router.createUrlTree(['/dashboard']);
};
