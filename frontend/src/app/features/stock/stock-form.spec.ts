import { Producto } from '../../core/api/modelos';
import {
    AJUSTE_VACIO,
    FormularioAjuste,
    FormularioIngreso,
    INGRESO_VACIO,
    validarAjuste,
    validarIngreso,
} from './stock-form';

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
    nombre: 'Pan francés',
    stock: '10.000',
    unidad: 2,
    unidad_nombre: 'Kilogramo',
    unidad_abreviatura: 'kg',
    unidad_permite_decimales: true,
});

function ingreso(cambios: Partial<FormularioIngreso> = {}): FormularioIngreso {
    return { ...INGRESO_VACIO, producto: pan, cantidad: '5', motivo: 'Compra a proveedor', ...cambios };
}

function ajuste(cambios: Partial<FormularioAjuste> = {}): FormularioAjuste {
    return { ...AJUSTE_VACIO, producto: pan, cantidad: '2', motivo: 'Merma', ...cambios };
}

describe('validarIngreso', () => {
    it('un ingreso completo da los datos listos para enviar', () => {
        const r = validarIngreso(ingreso({ cantidad: '5,250', motivo: ' Compra ', referencia: ' Remito 123 ' }));

        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({ producto: 2, cantidad: '5.25', motivo: 'Compra', referencia: 'Remito 123' });
    });

    it('sin referencia no la envía', () => {
        for (const referencia of ['', '   ']) {
            const r = validarIngreso(ingreso({ referencia }));

            expect(r.datos).toBeDefined();
            expect('referencia' in (r.datos ?? {})).toBe(false);
        }
    });

    it('el producto es obligatorio y no se muestran errores de cantidad en cascada', () => {
        const r = validarIngreso(ingreso({ producto: null, cantidad: 'abc' }));

        expect(Object.keys(r.errores)).toEqual(['producto']);
        expect(r.datos).toBeUndefined();
    });

    it('rechaza cantidades vacías, en cero, negativas, con muchos decimales o que no son números', () => {
        for (const cantidad of ['', '0', '0,000', '-1', '1,2345', 'abc']) {
            const r = validarIngreso(ingreso({ cantidad }));

            expect(r.errores.cantidad).toBeDefined();
            expect(r.datos).toBeUndefined();
        }
    });

    it('en una unidad entera rechaza decimales con el mismo mensaje del backend', () => {
        const r = validarIngreso(ingreso({ producto: gaseosa, cantidad: '2,5' }));

        expect(r.errores.cantidad).toBe('La unidad "Unidad" solo admite cantidades enteras.');
    });

    it('en una unidad con decimales acepta coma y hasta tres decimales', () => {
        expect(validarIngreso(ingreso({ cantidad: '0,125' })).datos?.cantidad).toBe('0.125');
        expect(validarIngreso(ingreso({ producto: gaseosa, cantidad: '12' })).datos?.cantidad).toBe('12');
    });

    it('respeta el máximo de 9 cifras enteras', () => {
        expect(validarIngreso(ingreso({ cantidad: '999999999' })).errores.cantidad).toBeUndefined();
        expect(validarIngreso(ingreso({ cantidad: '1000000000' })).errores.cantidad).toContain('demasiado alta');
    });

    it('el motivo es obligatorio y tiene un máximo de 255 caracteres', () => {
        for (const motivo of ['', '   ']) {
            expect(validarIngreso(ingreso({ motivo })).errores.motivo).toContain('obligatorio');
        }
        expect(validarIngreso(ingreso({ motivo: 'x'.repeat(255) })).errores.motivo).toBeUndefined();
        expect(validarIngreso(ingreso({ motivo: 'x'.repeat(256) })).errores.motivo).toContain('255');
    });

    it('la referencia tiene un máximo de 100 caracteres', () => {
        expect(validarIngreso(ingreso({ referencia: 'x'.repeat(100) })).errores.referencia).toBeUndefined();
        expect(validarIngreso(ingreso({ referencia: 'x'.repeat(101) })).errores.referencia).toContain('100');
    });
});

describe('validarAjuste', () => {
    it('aumentar envía la cantidad positiva', () => {
        const r = validarAjuste(ajuste({ sentido: 'aumentar', cantidad: '3' }));

        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({ producto: 2, cantidad: '3', motivo: 'Merma' });
    });

    it('disminuir arma el valor con signo negativo', () => {
        const r = validarAjuste(ajuste({ sentido: 'disminuir', cantidad: '2,5' }));

        expect(r.datos?.cantidad).toBe('-2.5');
    });

    it('no deja disminuir más que el stock actual y lo informa en la unidad del producto', () => {
        const r = validarAjuste(ajuste({ sentido: 'disminuir', cantidad: '10,5' }));

        expect(r.errores.cantidad).toContain('No podés descontar más que el stock actual (10 kg)');
        expect(r.datos).toBeUndefined();
    });

    it('permite disminuir justo hasta dejar el stock en cero', () => {
        const r = validarAjuste(ajuste({ sentido: 'disminuir', cantidad: '10' }));

        expect(r.errores).toEqual({});
        expect(r.datos?.cantidad).toBe('-10');
    });

    it('aumentar no tiene tope por el stock actual', () => {
        const r = validarAjuste(ajuste({ sentido: 'aumentar', cantidad: '500' }));

        expect(r.errores).toEqual({});
        expect(r.datos?.cantidad).toBe('500');
    });

    it('en una unidad entera rechaza decimales', () => {
        const r = validarAjuste(ajuste({ producto: gaseosa, cantidad: '1,5' }));

        expect(r.errores.cantidad).toContain('solo admite cantidades enteras');
    });

    it('el motivo es obligatorio', () => {
        expect(validarAjuste(ajuste({ motivo: '   ' })).errores.motivo).toContain('obligatorio');
    });

    it('informa todos los errores a la vez', () => {
        const r = validarAjuste(ajuste({ producto: null, motivo: '' }));

        expect(Object.keys(r.errores).sort()).toEqual(['motivo', 'producto']);
        expect(r.datos).toBeUndefined();
    });
});
