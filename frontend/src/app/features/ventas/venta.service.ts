import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Producto } from '../productos/producto.model';
import { DetalleVenta, Venta } from './venta.model';

export interface ItemCarrito {
    producto: Producto;
    cantidad: number;
}

interface DetalleVentaApiDto {
    id: number;
    producto: number;
    producto_nombre: string;
    cantidad: number;
    precio_unitario: string;
    subtotal: string;
}

interface VentaApiDto {
    id: number;
    usuario: number;
    fecha: string;
    total: string;
    impuestos_nacionales: string;
    activa: boolean;
    detalles: DetalleVentaApiDto[];
}

interface ComprobanteApiDto {
    id: number;
    venta: number;
    numero: number;
    fecha_emision: string;
    estado: string;
}

export interface Comprobante {
    id: number;
    venta: number;
    numero: number;
    fechaEmision: string;
    estado: string;
}

function mapearDetalle(dto: DetalleVentaApiDto): DetalleVenta {
    return {
        id: dto.id,
        producto: dto.producto,
        productoNombre: dto.producto_nombre,
        cantidad: dto.cantidad,
        precioUnitario: Number(dto.precio_unitario),
        subtotal: Number(dto.subtotal),
    };
}

function mapearVenta(dto: VentaApiDto): Venta {
    return {
        id: dto.id,
        usuario: dto.usuario,
        fecha: dto.fecha,
        total: Number(dto.total),
        impuestosNacionales: Number(dto.impuestos_nacionales),
        activa: dto.activa,
        detalles: dto.detalles.map(mapearDetalle),
    };
}

function mapearComprobante(dto: ComprobanteApiDto): Comprobante {
    return {
        id: dto.id,
        venta: dto.venta,
        numero: dto.numero,
        fechaEmision: dto.fecha_emision,
        estado: dto.estado,
    };
}

@Injectable({
    providedIn: 'root'
})
export class VentaService {
    private http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/ventas/`;
    private readonly comprobantesUrl = `${environment.apiUrl}/comprobantes/`;

    private carritoState = signal<ItemCarrito[]>([]);
    public carrito = this.carritoState.asReadonly();

    private ultimaVentaState = signal<Venta | null>(null);
    public ultimaVenta = this.ultimaVentaState.asReadonly();

    private ultimoComprobanteState = signal<Comprobante | null>(null);
    public ultimoComprobante = this.ultimoComprobanteState.asReadonly();

    public totalEstimado = computed(() =>
        this.carritoState().reduce((acc, item) => acc + (item.producto.precio * item.cantidad), 0)
    );

    agregarAlCarrito(producto: Producto, cantidad: number = 1): void {
        this.carritoState.update((items) => {
            const existe = items.find((item) => item.producto.id === producto.id);
            if (existe) {
                return items.map((item) =>
                    item.producto.id === producto.id
                        ? { ...item, cantidad: item.cantidad + cantidad }
                        : item
                );
            }
            return [...items, { producto, cantidad }];
        });
    }

    quitarDelCarrito(productoId: number): void {
        this.carritoState.update((items) => items.filter((item) => item.producto.id !== productoId));
    }

    limpiarCarrito(): void {
        this.carritoState.set([]);
    }

    confirmarVentaYEmitir(): Observable<Comprobante> {
        const items = this.carritoState().map((item) => ({
            producto: item.producto.id,
            cantidad: item.cantidad,
        }));

        return this.http.post<VentaApiDto>(this.baseUrl, { items }).pipe(
            tap((ventaDto) => {
                this.ultimaVentaState.set(mapearVenta(ventaDto));
                this.carritoState.set([]);
            }),
            switchMap((ventaDto) =>
                this.http.post<ComprobanteApiDto>(this.comprobantesUrl, { venta: ventaDto.id })
            ),
            tap((comprobanteDto) => {
                this.ultimoComprobanteState.set(mapearComprobante(comprobanteDto));
            }),
            switchMap(() => {
                const comprobante = this.ultimoComprobanteState();
                return new Observable<Comprobante>((subscriber) => {
                    subscriber.next(comprobante!);
                    subscriber.complete();
                });
            })
        );
    }
}