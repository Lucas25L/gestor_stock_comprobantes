import { LIMITE_MAXIMO, periodoInicial, validarPeriodo } from './indicadores-form';

describe('periodoInicial', () => {
    it('abre en el mes en curso hasta hoy, con el límite por defecto', () => {
        expect(periodoInicial(new Date(2026, 10, 15))).toEqual({
            desde: '2026-11-01',
            hasta: '2026-11-15',
            limite: '10',
        });
    });
});

describe('validarPeriodo', () => {
    const valido = { desde: '2026-11-01', hasta: '2026-11-15', limite: '10' };

    it('un período vacío es válido: el backend lo toma como período abierto', () => {
        const r = validarPeriodo({ desde: '', hasta: '', limite: '10' });
        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({ periodo: {}, limite: 10 });
    });

    it('acepta un período válido y lo devuelve como texto', () => {
        const r = validarPeriodo(valido);
        expect(r.errores).toEqual({});
        expect(r.datos).toEqual({ periodo: { desde: '2026-11-01', hasta: '2026-11-15' }, limite: 10 });
    });

    it('rechaza una fecha con formato inválido', () => {
        const r = validarPeriodo({ ...valido, desde: '15/11/2026' });
        expect(r.errores.desde).toBeDefined();
        expect(r.datos).toBeUndefined();
    });

    it('rechaza una fecha que no existe en el calendario', () => {
        const r = validarPeriodo({ ...valido, hasta: '2026-02-30' });
        expect(r.errores.hasta).toBeDefined();
        expect(r.datos).toBeUndefined();
    });

    it('rechaza un período con la fecha inicial posterior a la final', () => {
        const r = validarPeriodo({ ...valido, desde: '2026-11-16' });
        expect(r.errores.hasta).toBe('La fecha final no puede ser anterior a la inicial.');
        expect(r.datos).toBeUndefined();
    });

    it('acepta un período de un solo día (desde igual a hasta)', () => {
        const r = validarPeriodo({ ...valido, desde: '2026-11-15' });
        expect(r.errores).toEqual({});
        expect(r.datos?.periodo).toEqual({ desde: '2026-11-15', hasta: '2026-11-15' });
    });

    it('rechaza un límite que no es un entero', () => {
        for (const limite of ['', 'abc', '2.5', '-3']) {
            const r = validarPeriodo({ ...valido, limite });
            expect(r.errores.limite).toBe('Ingresá un número entero.');
        }
    });

    it('rechaza un límite fuera de rango', () => {
        for (const limite of ['0', String(LIMITE_MAXIMO + 1)]) {
            const r = validarPeriodo({ ...valido, limite });
            expect(r.errores.limite).toBe(`La cantidad debe estar entre 1 y ${LIMITE_MAXIMO}.`);
        }
        expect(validarPeriodo({ ...valido, limite: String(LIMITE_MAXIMO) }).errores).toEqual({});
    });
});
