import { UnidadMedida } from '../../core/api/modelos';
import { FORMULARIO_VACIO, FormularioProducto, validarProducto } from './producto-form';

const unidad: UnidadMedida = { id: 1, nombre: 'Unidad', abreviatura: 'u', permite_decimales: false, activo: true };
const kilo: UnidadMedida = { id: 2, nombre: 'Kilogramo', abreviatura: 'kg', permite_decimales: true, activo: true };
const unidades = [unidad, kilo];

function formulario(cambios: Partial<FormularioProducto> = {}): FormularioProducto {
    return {
        ...FORMULARIO_VACIO,
        nombre: 'Pan francés',
        precio: '2000',
        categoria: 1,
        unidad: 2,
        ...cambios,
    };
}

describe('validarProducto', () => {
    it('un formulario completo da los datos listos para enviar, sin stock', () => {
        const r = validarProducto(
            formulario({ descripcion: ' Del día ', precio: '2000,5', stockMinimo: '5', codigoBarras: ' 779 ' }),
            unidades,
            'crear',
        );

        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({
            nombre: 'Pan francés',
            descripcion: 'Del día',
            precio: '2000.5',
            stock_minimo: '5',
            codigo_barras: '779',
            categoria: 1,
            unidad: 2,
        });
        expect('stock' in (r.datos ?? {})).toBe(false);
        expect(r.stockInicial).toBeUndefined();
    });

    it('el código de barras vacío o con espacios se envía como null', () => {
        expect(validarProducto(formulario({ codigoBarras: '' }), unidades, 'crear').datos?.codigo_barras).toBeNull();
        expect(validarProducto(formulario({ codigoBarras: '   ' }), unidades, 'crear').datos?.codigo_barras).toBeNull();
    });

    it('el stock mínimo vacío se toma como 0', () => {
        expect(validarProducto(formulario({ stockMinimo: '' }), unidades, 'crear').datos?.stock_minimo).toBe('0');
    });

    describe('nombre y descripción', () => {
        it('el nombre es obligatorio', () => {
            for (const nombre of ['', '   ']) {
                const r = validarProducto(formulario({ nombre }), unidades, 'crear');
                expect(r.errores.nombre).toContain('obligatorio');
                expect(r.datos).toBeUndefined();
            }
        });

        it('respeta los largos máximos', () => {
            expect(validarProducto(formulario({ nombre: 'x'.repeat(150) }), unidades, 'crear').errores.nombre).toBeUndefined();
            expect(validarProducto(formulario({ nombre: 'x'.repeat(151) }), unidades, 'crear').errores.nombre).toContain('150');
            expect(validarProducto(formulario({ descripcion: 'x'.repeat(256) }), unidades, 'crear').errores.descripcion).toContain('255');
            expect(validarProducto(formulario({ codigoBarras: 'x'.repeat(51) }), unidades, 'crear').errores.codigoBarras).toContain('50');
        });
    });

    describe('precio', () => {
        it('acepta enteros y hasta dos decimales, con coma o punto', () => {
            expect(validarProducto(formulario({ precio: '1500' }), unidades, 'crear').datos?.precio).toBe('1500');
            expect(validarProducto(formulario({ precio: '1500,50' }), unidades, 'crear').datos?.precio).toBe('1500.50');
        });

        it('rechaza vacío, texto, negativos y más de dos decimales', () => {
            for (const precio of ['', 'abc', '-5', '1,234', '1.500,50']) {
                expect(validarProducto(formulario({ precio }), unidades, 'crear').errores.precio).toContain('precio válido');
            }
        });

        it('rechaza el cero', () => {
            for (const precio of ['0', '0,00']) {
                expect(validarProducto(formulario({ precio }), unidades, 'crear').errores.precio).toContain('mayor a 0');
            }
        });

        it('respeta el máximo de 8 cifras enteras', () => {
            expect(validarProducto(formulario({ precio: '99999999,99' }), unidades, 'crear').errores.precio).toBeUndefined();
            expect(validarProducto(formulario({ precio: '100000000' }), unidades, 'crear').errores.precio).toContain('demasiado alto');
        });
    });

    describe('categoría y unidad', () => {
        it('son obligatorias', () => {
            const r = validarProducto(formulario({ categoria: null, unidad: null }), unidades, 'crear');

            expect(r.errores.categoria).toContain('categoría');
            expect(r.errores.unidad).toContain('unidad');
            expect(r.datos).toBeUndefined();
        });

        it('rechaza una unidad que no está en la lista', () => {
            expect(validarProducto(formulario({ unidad: 99 }), unidades, 'crear').errores.unidad).toContain('unidad');
        });

        it('sin unidad no valida las cantidades, para no mostrar errores en cascada', () => {
            const r = validarProducto(formulario({ unidad: null, stockMinimo: 'abc', stockInicial: 'abc' }), unidades, 'crear');

            expect(Object.keys(r.errores)).toEqual(['unidad']);
        });
    });

    describe('stock mínimo según la unidad', () => {
        it('admite decimales en una unidad que los permite, con coma o punto', () => {
            expect(validarProducto(formulario({ stockMinimo: '2,5' }), unidades, 'crear').datos?.stock_minimo).toBe('2.5');
            expect(validarProducto(formulario({ stockMinimo: '0.125' }), unidades, 'crear').datos?.stock_minimo).toBe('0.125');
        });

        it('rechaza decimales en una unidad entera, con el mismo mensaje del backend', () => {
            const r = validarProducto(formulario({ unidad: 1, stockMinimo: '2,5' }), unidades, 'crear');

            expect(r.errores.stockMinimo).toBe('La unidad "Unidad" solo admite cantidades enteras.');
        });

        it('permite 0 pero no negativos ni más de 3 decimales ni texto', () => {
            expect(validarProducto(formulario({ stockMinimo: '0' }), unidades, 'crear').datos?.stock_minimo).toBe('0');
            expect(validarProducto(formulario({ stockMinimo: '0,000' }), unidades, 'crear').datos?.stock_minimo).toBe('0');
            for (const stockMinimo of ['-1', '1,2345', 'abc']) {
                expect(validarProducto(formulario({ stockMinimo }), unidades, 'crear').errores.stockMinimo).toBeDefined();
            }
        });

        it('respeta el máximo de 9 cifras enteras', () => {
            expect(validarProducto(formulario({ stockMinimo: '999999999' }), unidades, 'crear').errores.stockMinimo).toBeUndefined();
            expect(validarProducto(formulario({ stockMinimo: '1000000000' }), unidades, 'crear').errores.stockMinimo).toContain('demasiado alta');
        });
    });

    describe('stock inicial', () => {
        it('es opcional y, si se pide, se devuelve aparte de los datos del producto', () => {
            const r = validarProducto(formulario({ stockInicial: '10,5' }), unidades, 'crear');

            expect(r.errores).toEqual({});
            expect(r.stockInicial).toBe('10.5');
            expect('stock' in (r.datos ?? {})).toBe(false);
        });

        it('exige una cantidad mayor a 0', () => {
            for (const stockInicial of ['0', '0,000', '-3']) {
                expect(validarProducto(formulario({ stockInicial }), unidades, 'crear').errores.stockInicial).toBeDefined();
            }
        });

        it('respeta la unidad: entero en Unidad, decimales en Kilogramo', () => {
            expect(validarProducto(formulario({ unidad: 1, stockInicial: '3' }), unidades, 'crear').stockInicial).toBe('3');
            expect(validarProducto(formulario({ unidad: 1, stockInicial: '3,5' }), unidades, 'crear').errores.stockInicial).toContain(
                'solo admite cantidades enteras',
            );
        });

        it('al editar se ignora: el stock solo cambia con movimientos', () => {
            const r = validarProducto(formulario({ stockInicial: 'abc' }), unidades, 'editar');

            expect(r.errores).toEqual({});
            expect(r.stockInicial).toBeUndefined();
        });
    });

    it('informa todos los errores a la vez, no de a uno', () => {
        const r = validarProducto(formulario({ nombre: '', precio: '0', categoria: null }), unidades, 'crear');

        expect(Object.keys(r.errores).sort()).toEqual(['categoria', 'nombre', 'precio']);
    });
});
