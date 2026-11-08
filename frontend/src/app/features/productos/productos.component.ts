import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { Producto } from '../../core/api/modelos';
import { AuthService } from '../../core/services/auth.service';
import { formatearCantidad, formatearDinero } from '../../core/utils/decimal';
import { FORMULARIO_VACIO, FormularioProducto, formularioDe } from './producto-form';
import { FiltrosLista, ProductosStore } from './productos.store';

@Component({
    selector: 'app-productos',
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
    providers: [ProductosStore],
    templateUrl: './productos.component.html',
    styleUrl: './productos.component.css',
})
export class ProductosComponent implements OnInit {
    readonly #auth = inject(AuthService);
    readonly store = inject(ProductosStore);

    readonly formatearDinero = formatearDinero;
    readonly formatearCantidad = formatearCantidad;

    /** Solo el Administrador crea, edita, desactiva y reactiva productos. */
    readonly esAdministrador = computed(() => this.#auth.tieneRol(['Administrador']));

    readonly formularioAbierto = signal(false);
    /** Producto que se está editando; null si el formulario es un alta. */
    readonly editando = signal<Producto | null>(null);
    readonly formulario = signal<FormularioProducto>({ ...FORMULARIO_VACIO });
    readonly aDesactivar = signal<Producto | null>(null);

    readonly opcionesCategoriaFiltro = computed(() => [
        { id: null as number | null, nombre: 'Todas' },
        ...this.store.categorias().map((c) => ({ id: c.id as number | null, nombre: c.nombre })),
    ]);

    readonly opcionesUnidadFiltro = computed(() => [
        { id: null as number | null, nombre: 'Todas' },
        ...this.store.unidades().map((u) => ({ id: u.id as number | null, nombre: `${u.nombre} (${u.abreviatura})` })),
    ]);

    /** Categorías activas, más la actual del producto si ya está desactivada. */
    readonly opcionesCategoriaForm = computed(() => {
        const opciones = this.store.categorias().map((c) => ({ id: c.id, nombre: c.nombre }));
        const actual = this.editando();
        if (actual && !opciones.some((o) => o.id === actual.categoria)) {
            opciones.push({ id: actual.categoria, nombre: `${actual.categoria_nombre} (desactivada)` });
        }
        return opciones;
    });

    /** Unidades activas, más la actual del producto si ya está desactivada. */
    readonly opcionesUnidadForm = computed(() => {
        const opciones = this.store.unidades().map((u) => ({ id: u.id, nombre: `${u.nombre} (${u.abreviatura})` }));
        const actual = this.editando();
        if (actual && !opciones.some((o) => o.id === actual.unidad)) {
            opciones.push({ id: actual.unidad, nombre: `${actual.unidad_nombre} (desactivada)` });
        }
        return opciones;
    });

    /** Abreviatura de la unidad elegida, para mostrarla junto al stock mínimo y al stock inicial. */
    readonly abreviaturaForm = computed(() => {
        const id = this.formulario().unidad;
        const unidad = this.store.unidades().find((u) => u.id === id);
        if (unidad) {
            return unidad.abreviatura;
        }
        const actual = this.editando();
        return actual && actual.unidad === id ? actual.unidad_abreviatura : '';
    });

    ngOnInit(): void {
        this.store.iniciar();
    }

    /** Los selectores y casillas buscan al instante; el texto se aplica con Enter o con el botón. */
    filtrar(cambios: Partial<FiltrosLista>): void {
        this.store.actualizarFiltros(cambios);
        this.store.buscar();
    }

    cambiar<K extends keyof FormularioProducto>(campo: K, valor: FormularioProducto[K]): void {
        this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
    }

    abrirAlta(): void {
        this.store.limpiarFormulario();
        this.editando.set(null);
        this.formulario.set({ ...FORMULARIO_VACIO });
        this.formularioAbierto.set(true);
    }

    abrirEdicion(producto: Producto): void {
        this.store.limpiarFormulario();
        this.editando.set(producto);
        this.formulario.set(formularioDe(producto));
        this.formularioAbierto.set(true);
    }

    cerrarFormulario(): void {
        this.formularioAbierto.set(false);
    }

    guardar(): void {
        this.store.guardar(this.formulario(), this.editando(), () => this.cerrarFormulario());
    }

    pedirDesactivar(producto: Producto): void {
        this.aDesactivar.set(producto);
    }

    cancelarDesactivar(): void {
        this.aDesactivar.set(null);
    }

    confirmarDesactivar(): void {
        const producto = this.aDesactivar();
        if (producto) {
            this.store.desactivar(producto);
            this.aDesactivar.set(null);
        }
    }
}
