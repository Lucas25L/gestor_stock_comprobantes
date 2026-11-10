import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { MovimientoStock, Producto, TipoMovimiento } from '../../core/api/modelos';
import { AuthService } from '../../core/services/auth.service';
import { formatearCantidad } from '../../core/utils/decimal';
import { formatearFechaHora } from '../../core/utils/fechas';
import { AJUSTE_VACIO, FormularioAjuste, FormularioIngreso, INGRESO_VACIO, SentidoAjuste } from './stock-form';
import { FiltrosStock, StockStore } from './stock.store';

const OPCIONES_TIPO: { id: TipoMovimiento | null; nombre: string }[] = [
    { id: null, nombre: 'Todos' },
    { id: 'ingreso', nombre: 'Ingreso de mercadería' },
    { id: 'ajuste', nombre: 'Ajuste manual' },
    { id: 'venta', nombre: 'Venta' },
    { id: 'anulacion_venta', nombre: 'Anulación de venta' },
];

const OPCIONES_SENTIDO: { id: SentidoAjuste; nombre: string }[] = [
    { id: 'aumentar', nombre: 'Aumentar el stock' },
    { id: 'disminuir', nombre: 'Disminuir el stock' },
];

type SeveridadTag = 'success' | 'warn' | 'info' | 'secondary';

@Component({
    selector: 'app-stock',
    standalone: true,
    imports: [
        FormsModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        MessageModule,
        SelectModule,
        TableModule,
        TagModule,
    ],
    // El estado vive con la pantalla: al salir o cerrar sesión se destruye.
    providers: [StockStore],
    templateUrl: './stock.component.html',
    styleUrl: './stock.component.css',
})
export class StockComponent implements OnInit {
    readonly #auth = inject(AuthService);
    readonly store = inject(StockStore);

    readonly formatearFechaHora = formatearFechaHora;
    readonly formatearCantidad = formatearCantidad;
    readonly opcionesTipo = OPCIONES_TIPO;
    readonly opcionesSentido = OPCIONES_SENTIDO;

    /** Solo el Administrador puede listar usuarios; el Repositor filtra por "Solo mis movimientos". */
    readonly esAdministrador = computed(() => this.#auth.tieneRol(['Administrador']));
    readonly miId = computed(() => this.#auth.usuarioActual()?.id ?? null);

    readonly ingresoAbierto = signal(false);
    readonly ajusteAbierto = signal(false);
    readonly ingreso = signal<FormularioIngreso>({ ...INGRESO_VACIO });
    readonly ajuste = signal<FormularioAjuste>({ ...AJUSTE_VACIO });

    /** Abreviatura de la unidad de cada producto, para mostrar las cantidades de los movimientos. */
    readonly abreviaturas = computed(
        () => new Map(this.store.productos().map((producto) => [producto.id, producto.unidad_abreviatura] as const)),
    );

    readonly opcionesProductoFiltro = computed(() => [
        { id: null as number | null, nombre: 'Todos' },
        ...this.store.productos().map((producto) => ({
            id: producto.id as number | null,
            nombre: producto.activo ? producto.nombre : `${producto.nombre} (desactivado)`,
        })),
    ]);

    readonly opcionesUsuarioFiltro = computed(() => [
        { id: null as number | null, nombre: 'Todos' },
        ...this.store.usuarios().map((usuario) => ({
            id: usuario.id as number | null,
            nombre: usuario.is_active ? usuario.username : `${usuario.username} (desactivado)`,
        })),
    ]);

    /** Solo productos activos: el backend rechaza ingresos de productos desactivados (RN-10). */
    readonly opcionesIngreso = computed(() =>
        this.store.productosParaIngreso().map((producto) => ({ producto, etiqueta: this.#etiqueta(producto) })),
    );

    /** Todos los productos: el stock de un producto desactivado también se puede corregir. */
    readonly opcionesAjuste = computed(() =>
        this.store.productosParaAjuste().map((producto) => ({ producto, etiqueta: this.#etiqueta(producto) })),
    );

    readonly abreviaturaIngreso = computed(() => this.ingreso().producto?.unidad_abreviatura ?? '');
    readonly abreviaturaAjuste = computed(() => this.ajuste().producto?.unidad_abreviatura ?? '');

    ngOnInit(): void {
        this.store.iniciar({ cargarUsuarios: this.esAdministrador() });
    }

    /** Los selectores y la casilla buscan al instante; texto y fechas se aplican con Enter o con el botón. */
    filtrar(cambios: Partial<FiltrosStock>): void {
        this.store.actualizarFiltros(cambios);
        this.store.buscar();
    }

    soloMisMovimientos(marcada: boolean): void {
        this.filtrar({ usuario: marcada ? this.miId() : null });
    }

    cantidadConSigno(movimiento: MovimientoStock): string {
        const unidad = this.abreviaturas().get(movimiento.producto) ?? '';
        const negativa = movimiento.cantidad.startsWith('-');
        const absoluta = negativa ? movimiento.cantidad.slice(1) : movimiento.cantidad;
        return `${negativa ? '\u2212' : '+'}${formatearCantidad(absoluta)} ${unidad}`.trim();
    }

    esNegativa(movimiento: MovimientoStock): boolean {
        return movimiento.cantidad.startsWith('-');
    }

    stockResultante(movimiento: MovimientoStock): string {
        const unidad = this.abreviaturas().get(movimiento.producto) ?? '';
        return `${formatearCantidad(movimiento.stock_resultante)} ${unidad}`.trim();
    }

    severidadTipo(tipo: TipoMovimiento): SeveridadTag {
        switch (tipo) {
            case 'ingreso':
                return 'success';
            case 'ajuste':
                return 'warn';
            case 'venta':
                return 'info';
            case 'anulacion_venta':
                return 'secondary';
        }
    }

    // ----- ingreso -----

    cambiarIngreso<K extends keyof FormularioIngreso>(campo: K, valor: FormularioIngreso[K]): void {
        this.ingreso.update((actual) => ({ ...actual, [campo]: valor }));
    }

    abrirIngreso(): void {
        this.store.limpiarFormulario();
        this.ingreso.set({ ...INGRESO_VACIO });
        this.ingresoAbierto.set(true);
    }

    cerrarIngreso(): void {
        this.ingresoAbierto.set(false);
    }

    guardarIngreso(): void {
        this.store.ingresar(this.ingreso(), () => this.cerrarIngreso());
    }

    // ----- ajuste -----

    cambiarAjuste<K extends keyof FormularioAjuste>(campo: K, valor: FormularioAjuste[K]): void {
        this.ajuste.update((actual) => ({ ...actual, [campo]: valor }));
    }

    abrirAjuste(): void {
        this.store.limpiarFormulario();
        this.ajuste.set({ ...AJUSTE_VACIO });
        this.ajusteAbierto.set(true);
    }

    cerrarAjuste(): void {
        this.ajusteAbierto.set(false);
    }

    guardarAjuste(): void {
        this.store.ajustar(this.ajuste(), () => this.cerrarAjuste());
    }

    #etiqueta(producto: Producto): string {
        const estado = producto.activo ? '' : ' (desactivado)';
        return `${producto.nombre} \u00b7 stock ${formatearCantidad(producto.stock)} ${producto.unidad_abreviatura}${estado}`;
    }
}
