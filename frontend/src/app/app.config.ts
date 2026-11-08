import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { ApplicationConfig, LOCALE_ID, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';

// Proveedores globales de la aplicación: en este archivo se registran
// servicios y configuraciones centrales (ruteo, cliente HTTP, temas, etc.)
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import Aura from '@primeng/themes/aura';
import { TRADUCCION_ES } from './core/i18n/primeng-es';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { initAuth } from './core/initializers/auth.initializer';

// Datos de formato de Argentina (separador decimal, miles, nombres de meses) para los pipes.
registerLocaleData(localeEsAr);

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
    { provide: LOCALE_ID, useValue: 'es-AR' },
    provideRouter(routes),

    providePrimeNG({
      translation: TRADUCCION_ES,
      theme: {
        preset: Aura
      }
    })
  ]
};