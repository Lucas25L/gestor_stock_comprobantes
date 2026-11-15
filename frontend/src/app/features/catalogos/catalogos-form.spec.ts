import {
    MAX_ABREVIATURA,
    MAX_DESCRIPCION,
    MAX_NOMBRE_CATEGORIA,
    MAX_NOMBRE_MEDIO_PAGO,
    MAX_NOMBRE_UNIDAD,
    validarCategoria,
    validarMedioPago,
    validarUnidad,
} from './catalogos-form';

describe('validarCategoria', () => {
    it('recorta los espacios y devuelve los datos listos para enviar', () => {
        const r = validarCategoria({ nombre: '  Panadería ', descripcion: ' Pan y facturas ' });
        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({ nombre: 'Panadería', descripcion: 'Pan y facturas' });
    });

    it('rechaza un nombre vacío o solo con espacios; la descripción es opcional', () => {
        const r = validarCategoria({ nombre: '   ', descripcion: '' });
        expect(r.errores.nombre).toBe('Este dato es obligatorio.');
        expect(r.errores.descripcion).toBeUndefined();
        expect(r.datos).toBeUndefined();
    });

    it('acepta el nombre en el largo máximo y rechaza uno más', () => {
        expect(validarCategoria({ nombre: 'a'.repeat(MAX_NOMBRE_CATEGORIA), descripcion: '' }).errores).toEqual({});
        const r = validarCategoria({ nombre: 'a'.repeat(MAX_NOMBRE_CATEGORIA + 1), descripcion: '' });
        expect(r.errores.nombre).toBe(`No puede superar los ${MAX_NOMBRE_CATEGORIA} caracteres.`);
    });

    it('rechaza una descripción demasiado larga', () => {
        const r = validarCategoria({ nombre: 'Bebidas', descripcion: 'x'.repeat(MAX_DESCRIPCION + 1) });
        expect(r.errores.descripcion).toBe(`No puede superar los ${MAX_DESCRIPCION} caracteres.`);
        expect(r.datos).toBeUndefined();
    });
});

describe('validarUnidad', () => {
    it('devuelve los datos con permite_decimales tal como se eligió', () => {
        const r = validarUnidad({ nombre: ' Kilogramo ', abreviatura: ' kg ', permiteDecimales: true });
        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({ nombre: 'Kilogramo', abreviatura: 'kg', permite_decimales: true });
    });

    it('exige nombre y abreviatura', () => {
        const r = validarUnidad({ nombre: '', abreviatura: ' ', permiteDecimales: false });
        expect(r.errores.nombre).toBe('Este dato es obligatorio.');
        expect(r.errores.abreviatura).toBe('Este dato es obligatorio.');
        expect(r.datos).toBeUndefined();
    });

    it('respeta los largos máximos de nombre y abreviatura', () => {
        const justo = validarUnidad({
            nombre: 'n'.repeat(MAX_NOMBRE_UNIDAD),
            abreviatura: 'a'.repeat(MAX_ABREVIATURA),
            permiteDecimales: false,
        });
        expect(justo.errores).toEqual({});

        const largo = validarUnidad({
            nombre: 'n'.repeat(MAX_NOMBRE_UNIDAD + 1),
            abreviatura: 'a'.repeat(MAX_ABREVIATURA + 1),
            permiteDecimales: false,
        });
        expect(largo.errores.nombre).toBeDefined();
        expect(largo.errores.abreviatura).toBeDefined();
    });

    it('conserva permite_decimales en falso', () => {
        const r = validarUnidad({ nombre: 'Unidad', abreviatura: 'u', permiteDecimales: false });
        expect(r.datos?.permite_decimales).toBe(false);
    });
});

describe('validarMedioPago', () => {
    it('recorta los espacios y acepta una descripción vacía', () => {
        const r = validarMedioPago({ nombre: ' Transferencia ', descripcion: '  ' });
        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({ nombre: 'Transferencia', descripcion: '' });
    });

    it('rechaza un nombre vacío', () => {
        const r = validarMedioPago({ nombre: '', descripcion: '' });
        expect(r.errores.nombre).toBe('Este dato es obligatorio.');
        expect(r.datos).toBeUndefined();
    });

    it('respeta el largo máximo del nombre (50, distinto del de categoría)', () => {
        expect(validarMedioPago({ nombre: 'a'.repeat(MAX_NOMBRE_MEDIO_PAGO), descripcion: '' }).errores).toEqual({});
        const r = validarMedioPago({ nombre: 'a'.repeat(MAX_NOMBRE_MEDIO_PAGO + 1), descripcion: '' });
        expect(r.errores.nombre).toBe(`No puede superar los ${MAX_NOMBRE_MEDIO_PAGO} caracteres.`);
    });
});
