import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ComprobantesApi } from '../../core/api/comprobantes.api';
import { MediosPagoApi } from '../../core/api/medios-pago.api';
import { Comprobante, MedioPago, Producto, Venta } from '../../core/api/modelos';
import { ProductosApi } from '../../core/api/productos.api';
import { VentasApi } from '../../core/api/ventas.api';
import { compararDecimales } from '../../core/utils/decimal';
import { mensajeDeError } from '../../core/utils/errores';
import { CarritoService } from './carrito.service';

const MAXIMO_SUGERENCIAS = 20;

const MENSAJE_SIN_CONEXION =
    'No se pudo conectar con el servidor. Antes de reintentar, revisá el historial de ventas: ' +
    'es posible que la venta ya se haya registrado.';

/**
 * Productos que se pueden vender: los activos y, por RN-10, los desactivados que todavía
 * tienen stock. Un desactivado agotado ya no se puede vender y no se ofrece.
 */
function vendibles(productos: Producto[]): Producto[] {
    return productos.filter((p) => p.activo || compararDecimales(p.stock, '0') > 0);
}

/** Minúsculas y sin tildes, para que "cafe" encuentre "Café". */
function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Estado de la pantalla "Nueva venta". Se provee en el componente (no en root): al salir de
 * la pantalla o cerrar sesión se destruye, y nadie ve el carrito o el comprobante de otro.
 */
@Injectable()
export class NuevaVentaStore {
    readonly carrito = inject(CarritoService);
    readonly #productosApi = inject(ProductosApi);
    readonly #mediosPagoApi = inject(MediosPagoApi);
    readonly #ventasApi = inject(VentasApi);
    readonly #comprobantesApi = inject(ComprobantesApi);

    readonly #productos = signal<Producto[]>([]);
    readonly #mediosPago = signal<MedioPago[]>([]);
    readonly #cargando = signal(false);
    readonly #errorCarga = signal<string | null>(null);
    readonly #medioPagoId = signal<number | null>(null);
    readonly #confirmando = signal(false);
    readonly #errorVenta = signal<string | null>(null);
    readonly #ventaRegistrada = signal<Venta | null>(null);
    readonly #emitiendo = signal(false);
    readonly #errorComprobante = signal<string | null>(null);
    readonly #comprobante = signal<Comprobante | null>(null);

    readonly productos = this.#productos.asReadonly();
    readonly mediosPago = this.#mediosPago.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();
    readonly medioPagoId = this.#medioPagoId.asReadonly();
    readonly confirmando = this.#confirmando.asReadonly();
    readonly errorVenta = this.#errorVenta.asReadonly();
    readonly ventaRegistrada = this.#ventaRegistrada.asReadonly();
    readonly emitiendo = this.#emitiendo.asReadonly();
    readonly errorComprobante = this.#errorComprobante.asReadonly();
    readonly comprobante = this.#comprobante.asReadonly();

    readonly puedeConfirmar = computed(
        () =>
            !this.carrito.vacio() &&
            this.#medioPagoId() !== null &&
            !this.carrito.hayExcesoDeStock() &&
            !this.#confirmando() &&
            this.#ventaRegistrada() === null,
    );

    /** Carga los productos vendibles (activos y desactivados con stock) y los medios de pago activos. */
    cargar(): void {
        this.#cargando.set(true);
        this.#errorCarga.set(null);
        forkJoin({
            productos: this.#productosApi.listar({ incluir_inactivos: true }),
            mediosPago: this.#mediosPagoApi.listar(),
        }).subscribe({
            next: ({ productos, mediosPago }) => {
                this.#productos.set(vendibles(productos));
                this.#mediosPago.set(mediosPago);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(
                    mensajeDeError(error, 'No se pudieron cargar los productos y medios de pago.'),
                );
                this.#cargando.set(false);
            },
        });
    }

    /** Productos cuyo nombre o código de barras contiene el texto (sin tildes ni mayúsculas). */
    buscar(texto: string): Producto[] {
        const consulta = normalizar(texto);
        if (!consulta) {
            return [];
        }
        return this.#productos()
            .filter(
                (producto) =>
                    normalizar(producto.nombre).includes(consulta) ||
                    (producto.codigo_barras ?? '').toLowerCase().includes(consulta),
            )
            .slice(0, MAXIMO_SUGERENCIAS);
    }

    /** Coincidencia exacta de código de barras (lo que escribe un lector al escanear). */
    porCodigoBarras(texto: string): Producto | undefined {
        const codigo = texto.trim();
        return codigo ? this.#productos().find((p) => p.codigo_barras === codigo) : undefined;
    }

    seleccionarMedioPago(id: number | null): void {
        this.#medioPagoId.set(id);
    }

    /** Registra la venta con lo que hay en el carrito. No emite el comprobante. */
    confirmar(): void {
        const medioPago = this.#medioPagoId();
        if (!this.puedeConfirmar() || medioPago === null) {
            return;
        }
        this.#confirmando.set(true);
        this.#errorVenta.set(null);
        this.#ventasApi.crear(this.carrito.aNuevaVenta(medioPago)).subscribe({
            next: (venta) => {
                this.#ventaRegistrada.set(venta);
                this.carrito.vaciar();
                this.#confirmando.set(false);
                this.#recargarProductos();
            },
            error: (error: unknown) => {
                const sinConexion = error instanceof HttpErrorResponse && error.status === 0;
                this.#errorVenta.set(
                    sinConexion
                        ? MENSAJE_SIN_CONEXION
                        : mensajeDeError(error, 'No se pudo registrar la venta.'),
                );
                this.#confirmando.set(false);
                this.#recargarProductos();
            },
        });
    }

    /** Emite, a pedido, el comprobante de la venta recién registrada. */
    emitirComprobante(): void {
        const venta = this.#ventaRegistrada();
        if (!venta || this.#comprobante() || this.#emitiendo()) {
            return;
        }
        this.#emitiendo.set(true);
        this.#errorComprobante.set(null);
        this.#comprobantesApi.emitir(venta.id).subscribe({
            next: (comprobante) => {
                this.#comprobante.set(comprobante);
                this.#emitiendo.set(false);
            },
            error: (error: unknown) => {
                this.#errorComprobante.set(
                    mensajeDeError(error, 'No se pudo emitir el comprobante.'),
                );
                this.#emitiendo.set(false);
            },
        });
    }

    /** Vuelve a la pantalla de carga con el carrito vacío. */
    nuevaVenta(): void {
        this.carrito.vaciar();
        this.#medioPagoId.set(null);
        this.#ventaRegistrada.set(null);
        this.#comprobante.set(null);
        this.#errorVenta.set(null);
        this.#errorComprobante.set(null);
    }

    /** Actualiza el stock mostrado. Si falla, se sigue con los datos anteriores. */
    #recargarProductos(): void {
        this.#productosApi.listar({ incluir_inactivos: true }).subscribe({
            next: (productos) => this.#productos.set(vendibles(productos)),
            error: () => undefined,
        });
    }
}
