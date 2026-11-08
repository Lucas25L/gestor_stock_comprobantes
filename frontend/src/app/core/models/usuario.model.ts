import { Rol } from './rol';

export interface Usuario {
    id: number;
    username: string;
    email: string;
    rol: Rol;
}
