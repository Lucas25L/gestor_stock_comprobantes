import { Usuario } from "../usuario.model";

export interface AuthResponseDto {
    readonly refresh: string;
    readonly access: string;
    readonly usuario: Usuario;
}