import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Producto } from './producto.model';

interface ProductoApiDto {
    id: number;
    nombre: string;
    descripcion: string;
    precio: string;
    stock: number;
    stock_minimo: number;
    codigo_barras: string | null;
    categoria: number;
    categoria_nombre: string;
    activo: boolean;
}

function mapearProducto(dto: ProductoApiDto): Producto {
    return {
        id: dto.id,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        precio: Number(dto.precio),
        stock: dto.stock,
        stockMinimo: dto.stock_minimo,
        codigoBarras: dto.codigo_barras,
        categoria: dto.categoria,
        categoriaNombre: dto.categoria_nombre,
        activo: dto.activo,
    };
}

@Injectable({
    providedIn: 'root'
})
export class ProductoService {
    private http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/productos/`;

    private productosState = signal<Producto[]>([]);
    public productos = this.productosState.asReadonly();

    cargarProductos(): Observable<ProductoApiDto[]> {
        return this.http.get<ProductoApiDto[]>(this.baseUrl).pipe(
            tap((dtos) => this.productosState.set(dtos.map(mapearProducto)))
        );
    }

    agregarProducto(producto: {
        nombre: string;
        descripcion?: string;
        precio: number;
        stock: number;
        stockMinimo?: number;
        codigoBarras?: string;
        categoria: number;
    }): Observable<ProductoApiDto> {
        const body = {
            nombre: producto.nombre,
            descripcion: producto.descripcion ?? '',
            precio: producto.precio.toFixed(2),
            stock: producto.stock,
            stock_minimo: producto.stockMinimo ?? 0,
            codigo_barras: producto.codigoBarras || null,
            categoria: producto.categoria,
        };

        return this.http.post<ProductoApiDto>(this.baseUrl, body).pipe(
            tap((dto) => {
                const nuevo = mapearProducto(dto);
                this.productosState.update((prods) => [...prods, nuevo]);
            })
        );
    }
}