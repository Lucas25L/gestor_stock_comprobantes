import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { CategoriaService } from './categoria.service';
import { ProductoService } from './producto.service';

@Component({
    selector: 'app-lista-productos',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, InputTextModule, SelectModule],
    templateUrl: './lista-productos.component.html',
    styleUrl: './lista-productos.component.css'
})
export class ListaProductosComponent implements OnInit {
    private productoService = inject(ProductoService);
    private categoriaService = inject(CategoriaService);

    public productos = this.productoService.productos;
    public categorias = this.categoriaService.categorias;

    nuevoNombre = '';
    nuevoPrecio: number | null = null;
    nuevoStock: number | null = null;
    nuevaCategoria: number | null = null;

    guardando = signal(false);
    error = signal<string | null>(null);

    ngOnInit(): void {
        this.productoService.cargarProductos().subscribe();
        this.categoriaService.cargarCategorias().subscribe();
    }

    guardarProducto(): void {
        if (!this.nuevoNombre || this.nuevoPrecio === null || this.nuevoStock === null || this.nuevaCategoria === null) {
            this.error.set('Completá todos los campos, incluida la categoría.');
            return;
        }

        this.guardando.set(true);
        this.error.set(null);

        this.productoService.agregarProducto({
            nombre: this.nuevoNombre,
            precio: this.nuevoPrecio,
            stock: this.nuevoStock,
            categoria: this.nuevaCategoria,
        }).subscribe({
            next: () => {
                this.nuevoNombre = '';
                this.nuevoPrecio = null;
                this.nuevoStock = null;
                this.nuevaCategoria = null;
                this.guardando.set(false);
            },
            error: (err) => {
                this.error.set('No se pudo guardar el producto. Revisá los datos.');
                this.guardando.set(false);
                console.error(err);
            }
        });
    }
}