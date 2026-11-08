import { HttpErrorResponse } from '@angular/common/http';

import { mensajeDeError } from './errores';

function error(status: number, cuerpo: unknown): HttpErrorResponse {
    return new HttpErrorResponse({ status, error: cuerpo });
}

describe('mensajeDeError', () => {
    it('muestra el mensaje de un error de campo (lista)', () => {
        const mensaje = 'Stock insuficiente para "Pan". Disponible: 2.000, solicitado: 3.000.';
        expect(mensajeDeError(error(400, { items: [mensaje] }))).toBe(mensaje);
    });

    it('muestra el mensaje de detail', () => {
        expect(mensajeDeError(error(400, { detail: 'La venta ya está anulada.' }))).toBe(
            'La venta ya está anulada.',
        );
    });

    it('une los mensajes de varios campos', () => {
        const cuerpo = { motivo: ['Este campo es obligatorio.'], venta: 'La venta no existe.' };
        expect(mensajeDeError(error(400, cuerpo))).toBe(
            'Este campo es obligatorio. La venta no existe.',
        );
    });

    it('informa la falta de conexión', () => {
        expect(mensajeDeError(error(0, null))).toContain('No se pudo conectar');
    });

    it('informa la falta de permisos sin mostrar el detalle del servidor', () => {
        expect(mensajeDeError(error(403, { detail: 'texto interno' }))).toBe(
            'No tenés permisos para realizar esta acción.',
        );
    });

    it('oculta los errores del servidor', () => {
        expect(mensajeDeError(error(500, '<html>Traceback...</html>'))).toContain(
            'problema',
        );
    });

    it('no muestra páginas HTML y usa el mensaje por defecto', () => {
        expect(mensajeDeError(error(404, '<!doctype html><h1>Not Found</h1>'), 'No se encontró.')).toBe(
            'No se encontró.',
        );
    });

    it('usa el mensaje por defecto si no es un error HTTP', () => {
        expect(mensajeDeError(new Error('x'), 'Falló.')).toBe('Falló.');
    });
});
