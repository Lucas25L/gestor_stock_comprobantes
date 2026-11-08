import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MedioPago } from './modelos';

@Injectable({ providedIn: 'root' })
export class MediosPagoApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/medios-pago/`;

    /** Medios de pago activos (los puede consultar el Administrador y el Cajero). */
    listar(): Observable<MedioPago[]> {
        return this.http.get<MedioPago[]>(this.url);
    }
}
