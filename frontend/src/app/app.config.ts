import { ApplicationConfig, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';

// Proveedores globales de la aplicación: en este archivo se registran
// servicios y configuraciones centrales (ruteo, cliente HTTP, temas, etc.)
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { initAuth } from './core/initializers/auth.initializer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
        withFetch(),
        withInterceptors([authInterceptor]),
    ),
    provideAppInitializer(() => {
        const init = initAuth();
        return init();
    }),
    provideZonelessChangeDetection(),
    provideRouter(routes),

    providePrimeNG({
      theme: {
        preset: Aura
      }
    })
  ]
};