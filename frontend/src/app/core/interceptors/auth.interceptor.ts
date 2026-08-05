import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

let refrescando = false;
const tokenRefrescado$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);

    const token = authService.obtenerToken();
    const reqConToken = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(reqConToken).pipe(
        catchError((error: unknown) => {
            const esErrorDeAuth = error instanceof HttpErrorResponse && error.status === 401;
            const esRutaDeAuth = req.url.includes('/token/');

            if (!esErrorDeAuth || esRutaDeAuth) {
                return throwError(() => error);
            }

            if (!refrescando) {
                refrescando = true;
                tokenRefrescado$.next(null);

                return authService.refrescarSesion().pipe(
                    switchMap((respuesta) => {
                        refrescando = false;
                        tokenRefrescado$.next(respuesta.access);

                        const reqReintentada = req.clone({
                            setHeaders: { Authorization: `Bearer ${respuesta.access}` },
                        });
                        return next(reqReintentada);
                    }),
                    catchError((errorRefresh) => {
                        refrescando = false;
                        authService.logout();
                        return throwError(() => errorRefresh);
                    })
                );
            }

            return tokenRefrescado$.pipe(
                filter((accessToken) => accessToken !== null),
                take(1),
                switchMap((accessToken) => {
                    const reqReintentada = req.clone({
                        setHeaders: { Authorization: `Bearer ${accessToken}` },
                    });
                    return next(reqReintentada);
                })
            );
        })
    );
};