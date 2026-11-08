import { TestBed } from '@angular/core/testing';

import { Producto } from '../../core/api/modelos';
import { CarritoService } from './carrito.service';

function producto(datos: Partial<Producto>): Producto {
    return {
        id: 1,
        nombre: 'Gaseosa',
        descripcion: '',
        precio: '1500.00',
        stock: '100.000',
        stock_minimo: '0.000',
        codigo_barras: null,
        categoria: 1,
        categoria_nombre: 'Almacén',
        unidad: 1,
        unidad_nombre: 'Unidad',
        unidad_abreviatura: 'u',
        unidad_permite_decimales: false,
        stock_bajo: false,
        faltante: '0.000',
        activo: true,
        creado_en: '',
        actualizado_en: '',
        ...datos,
    };
}

const gaseosa = producto({});
const pan = producto({
    id: 2,
    nombre: 'Pan',
    precio: '2000.00',
    unidad: 2,
    unidad_nombre: 'Kilogramo',
    unidad_abreviatura: 'kg',
    unidad_permite_decimales: true,
});

describe('CarritoService', () => {
    let carrito: CarritoService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        carrito = TestBed.inject(CarritoService);
    });

    it('calcula el subtotal de cada línea y el total', () => {
        expect(carrito.agregar(gaseosa, '2')).toBeNull();
        expect(carrito.agregar(pan, '1.5')).toBeNull();

        expect(carrito.lineas().map((l) => l.subtotal)).toEqual(['3000.00', '3000.00']);
        expect(carrito.total()).toBe('6000.00');
        expect(carrito.vacio()).toBe(false);
    });

    it('suma las cantidades al agregar el mismo producto', () => {
        carrito.agregar(pan, '1.5');
        carrito.agregar(pan, '1.5');

        expect(carrito.lineas()).toHaveLength(1);
        expect(carrito.lineas()[0].cantidad).toBe('3');
        expect(carrito.lineas()[0].subtotal).toBe('6000.00');
    });

    it('rechaza decimales en un producto de unidad entera', () => {
        const error = carrito.agregar(gaseosa, '2.5');

        expect(error).toContain('solo admite cantidades enteras');
        expect(carrito.vacio()).toBe(true);
    });

    it('rechaza cantidades en cero o que no son números', () => {
        expect(carrito.agregar(pan, '0')).not.toBeNull();
        expect(carrito.agregar(pan, 'abc')).not.toBeNull();
        expect(carrito.agregar(pan, '1.2345')).not.toBeNull();
        expect(carrito.vacio()).toBe(true);
    });

    it('acepta la coma decimal y la guarda con punto', () => {
        expect(carrito.agregar(pan, '2,5')).toBeNull();

        expect(carrito.lineas()[0].cantidad).toBe('2.5');
    });

    it('cambia la cantidad de una línea y valida igual que al agregar', () => {
        carrito.agregar(gaseosa, '2');

        expect(carrito.cambiarCantidad(1, '5')).toBeNull();
        expect(carrito.lineas()[0].cantidad).toBe('5');

        expect(carrito.cambiarCantidad(1, '1.5')).not.toBeNull();
        expect(carrito.lineas()[0].cantidad).toBe('5');

        expect(carrito.cambiarCantidad(99, '1')).not.toBeNull();
    });

    it('marca las líneas que superan el stock', () => {
        const escaso = producto({ id: 3, nombre: 'Yerba', stock: '2.000' });

        carrito.agregar(escaso, '3');
        expect(carrito.lineas()[0].excedeStock).toBe(true);
        expect(carrito.hayExcesoDeStock()).toBe(true);

        carrito.cambiarCantidad(3, '2');
        expect(carrito.lineas()[0].excedeStock).toBe(false);
        expect(carrito.hayExcesoDeStock()).toBe(false);
    });

    it('quita una línea y vacía el carrito', () => {
        carrito.agregar(gaseosa, '1');
        carrito.agregar(pan, '1');

        carrito.quitar(1);
        expect(carrito.lineas().map((l) => l.producto.id)).toEqual([2]);

        carrito.vaciar();
        expect(carrito.vacio()).toBe(true);
        expect(carrito.total()).toBe('0.00');
    });

    it('arma el cuerpo de la venta con cantidades como texto y sin precios', () => {
        carrito.agregar(gaseosa, '2');
        carrito.agregar(pan, '1.500');

        expect(carrito.aNuevaVenta(3)).toEqual({
            medio_pago: 3,
            items: [
                { producto: 1, cantidad: '2' },
                { producto: 2, cantidad: '1.5' },
            ],
        });
    });
});
