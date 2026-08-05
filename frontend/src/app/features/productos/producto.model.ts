export interface Producto {
    id: number;
    nombre: string;
    descripcion: string;
    precio: number;
    stock: number;
    stockMinimo: number;
    codigoBarras: string | null;
    categoria: number;
    categoriaNombre: string;
    activo: boolean;
}