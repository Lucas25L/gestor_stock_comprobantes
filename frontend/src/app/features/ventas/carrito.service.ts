import { Injectable, computed, signal } from '@angular/core';

import { NuevaVenta, Producto } from '../../core/api/modelos';
import {
    compararDecimales,
    esCantidadValida,
    multiplicarDinero,
    normalizarCantidad,
    sumarCantidades,
    sumarDinero,
} from '../../core/utils/decimal';

export interface ItemCarrito {
    producto: Producto;
    /** Cantidad como texto decimal en su forma mínima ("3", "2.5"). */
    cantidad: string;
}

export interface LineaCarrito extends ItemCarrito {
    subtotal: string;
    excedeStock: boolean;
}

/**
 * Estado del carrito de la venta en curso. Los importes se calculan con aritmética decimal
 * exacta, con la misma regla de redondeo del backend. El total es una estimación: el
 * definitivo lo calcula el servidor con el precio vigente al confirmar.
 */
@Injectable({ providedIn: 'root' })
export class CarritoService {
    readonly #items = signal<ItemCarrito[]>([]);

    readonly lineas = computed<LineaCarrito[]>(() =>
        this.#items().map((item) => ({
            ...item,
            subtotal: multiplicarDinero(item.producto.precio, item.cantidad),
            excedeStock: compararDecimales(item.cantidad, item.producto.stock) > 0,
        })),
    );
    readonly total = computed(() => sumarDinero(this.lineas().map((linea) => linea.subtotal)));
    readonly vacio = computed(() => this.#items().length === 0);
    readonly hayExcesoDeStock = computed(() => this.lineas().some((linea) => linea.excedeStock));

    /** Agrega el producto (o suma a lo que ya hay). Devuelve un mensaje de error, o null si salió bien. */
    agregar(producto: Producto, cantidad: string): string | null {
        const texto = this.#limpiar(cantidad);
        const error = this.#validar(producto, texto);
        if (error) {
            return error;
        }
        this.#items.update((items) => {
            const existente = items.find((item) => item.producto.id === producto.id);
            if (!existente) {
                return [...items, { producto, cantidad: normalizarCantidad(texto) }];
            }
            return items.map((item) =>
                item.producto.id === producto.id
                    ? { ...item, cantidad: sumarCantidades(item.cantidad, texto) }
                    : item,
            );
        });
        return null;
    }

    /** Reemplaza la cantidad de una línea. Devuelve un mensaje de error, o null si salió bien. */
    cambiarCantidad(productoId: number, cantidad: string): string | null {
        const item = this.#items().find((i) => i.producto.id === productoId);
        if (!item) {
            return 'El producto no está en el carrito.';
        }
        const texto = this.#limpiar(cantidad);
        const error = this.#validar(item.producto, texto);
        if (error) {
            return error;
        }
        this.#items.update((items) =>
            items.map((i) =>
                i.producto.id === productoId ? { ...i, cantidad: normalizarCantidad(texto) } : i,
            ),
        );
        return null;
    }

    quitar(productoId: number): void {
        this.#items.update((items) => items.filter((item) => item.producto.id !== productoId));
    }

    vaciar(): void {
        this.#items.set([]);
    }

    /** Cuerpo de POST /api/ventas/. No incluye precios ni total: los calcula el backend. */
    aNuevaVenta(medioPago: number): NuevaVenta {
        return {
            medio_pago: medioPago,
            items: this.#items().map((item) => ({
                producto: item.producto.id,
                cantidad: item.cantidad,
            })),
        };
    }

    /** Se acepta la coma decimal ("2,5"), que es como se escribe en Argentina. */
    #limpiar(cantidad: string): string {
        return cantidad.trim().replace(',', '.');
    }

    #validar(producto: Producto, texto: string): string | null {
        if (esCantidadValida(texto, producto.unidad_permite_decimales)) {
            return null;
        }
        if (!producto.unidad_permite_decimales && texto.includes('.')) {
            return (
                `"${producto.nombre}" se vende por ${producto.unidad_nombre.toLowerCase()} ` +
                'y solo admite cantidades enteras.'
            );
        }
        return producto.unidad_permite_decimales
            ? 'Ingresá una cantidad mayor a 0, con hasta 3 decimales.'
            : 'Ingresá una cantidad entera mayor a 0.';
    }
}
