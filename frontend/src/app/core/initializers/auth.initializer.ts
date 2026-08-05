import { inject } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

export function initAuth(): () => Promise<void> {
    const authService = inject(AuthService);

    return () =>
        firstValueFrom(
            authService.refrescarSesion().pipe(
                catchError(() => of(null))
            )
        ).then(() => void 0);
}