import { fechaDesdeISO, fechaISO, formatearFechaHora, rangoDe } from './fechas';

describe('fechas', () => {
    describe('fechaISO', () => {
        it('usa el día local, con ceros a la izquierda', () => {
            expect(fechaISO(new Date(2026, 10, 8))).toBe('2026-11-08');
            expect(fechaISO(new Date(2026, 0, 5))).toBe('2026-01-05');
        });

        it('no corre el día por la hora', () => {
            expect(fechaISO(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
            expect(fechaISO(new Date(2026, 10, 1, 0, 1))).toBe('2026-11-01');
        });
    });

    describe('rangoDe', () => {
        it('hoy', () => {
            expect(rangoDe('hoy', new Date(2026, 10, 8))).toEqual({
                desde: '2026-11-08',
                hasta: '2026-11-08',
            });
        });

        it('últimos 7 días incluye hoy', () => {
            expect(rangoDe('ultimos7', new Date(2026, 10, 8))).toEqual({
                desde: '2026-11-02',
                hasta: '2026-11-08',
            });
        });

        it('últimos 7 días cruza el cambio de mes', () => {
            expect(rangoDe('ultimos7', new Date(2026, 10, 3))).toEqual({
                desde: '2026-10-28',
                hasta: '2026-11-03',
            });
        });

        it('este mes arranca el día 1', () => {
            expect(rangoDe('mes', new Date(2026, 10, 18))).toEqual({
                desde: '2026-11-01',
                hasta: '2026-11-18',
            });
        });
    });

    describe('fechaDesdeISO', () => {
        it('crea la fecha a medianoche local', () => {
            const fecha = fechaDesdeISO('2026-11-08');
            expect(fecha?.getFullYear()).toBe(2026);
            expect(fecha?.getMonth()).toBe(10);
            expect(fecha?.getDate()).toBe(8);
            expect(fecha?.getHours()).toBe(0);
        });

        it('es la inversa de fechaISO', () => {
            for (const texto of ['2026-01-05', '2026-10-31', '2026-12-31', '2028-02-29']) {
                const fecha = fechaDesdeISO(texto);
                expect(fecha && fechaISO(fecha)).toBe(texto);
            }
        });

        it('rechaza lo que no es una fecha real', () => {
            for (const texto of ['2026-02-30', '2026-13-01', '2027-02-29', '08/11/2026', 'hola', '']) {
                expect(fechaDesdeISO(texto)).toBeNull();
            }
        });
    });

    describe('formatearFechaHora', () => {
        it('muestra la hora de Buenos Aires aunque llegue en UTC', () => {
            expect(formatearFechaHora('2026-11-01T02:30:00Z')).toBe('31/10/2026 23:30');
        });

        it('respeta el desfase que trae la fecha', () => {
            expect(formatearFechaHora('2026-11-08T11:05:00-03:00')).toBe('08/11/2026 11:05');
        });

        it('muestra la medianoche como 00:00', () => {
            expect(formatearFechaHora('2026-11-08T03:00:00Z')).toBe('08/11/2026 00:00');
        });
    });
});
