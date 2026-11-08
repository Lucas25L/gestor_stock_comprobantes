import { Usuario } from '../usuario.model';

// El refresh token no viaja en el cuerpo: el backend lo guarda en la cookie HttpOnly.
export interface AuthResponseDto {
    readonly access: string;
    readonly usuario: Usuario;
}
