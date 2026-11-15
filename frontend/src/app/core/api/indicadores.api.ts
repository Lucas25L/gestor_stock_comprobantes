import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { aParams } from './api-params';
import {
    CategoriaMasVendida,
    IndicadorMedioPago,
    ProductoMasVendido,
    ResumenVentas,
} from './modelos';

/** Período por días calendario (AAAA-MM-DD). Ambos extremos son opcionales. */
export interface PeriodoIndicadores {
    desde?: string;
    hasta?: string;
}

export interface FiltrosRanking extends PeriodoIndicadores {
    /** Máximo de filas (el backend admite de 1 a 50; por defecto 10). */
    limite?: number;
}

export interface FiltrosProductosMasVendidos extends FiltrosRanking {
    /** Id de la unidad de medida: rankea solo productos de esa unidad. */
    unidad?: number;
}

/** Indicadores de ventas (RF-43 a RF-46). Solo el Administrador; el resto recibe 403. */
@Injectable({ providedIn: 'root' })
export class IndicadoresApi {
    private http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/indicadores/`;

    resumen(periodo: PeriodoIndicadores = {}): Observable<ResumenVentas> {
        return this.http.get<ResumenVentas>(`${this.url}resumen/`, { params: aParams(periodo) });
    }

    porMedioPago(periodo: PeriodoIndicadores = {}): Observable<IndicadorMedioPago[]> {
        return this.http.get<IndicadorMedioPago[]>(`${this.url}por-medio-pago/`, {
            params: aParams(periodo),
        });
    }

    productosMasVendidos(filtros: FiltrosProductosMasVendidos = {}): Observable<ProductoMasVendido[]> {
        return this.http.get<ProductoMasVendido[]>(`${this.url}productos-mas-vendidos/`, {
            params: aParams(filtros),
        });
    }

    categoriasMasVendidas(filtros: FiltrosRanking = {}): Observable<CategoriaMasVendida[]> {
        return this.http.get<CategoriaMasVendida[]>(`${this.url}categorias-mas-vendidas/`, {
            params: aParams(filtros),
        });
    }
}
