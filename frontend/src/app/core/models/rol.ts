// Nombres de rol tal como los envía el backend (usuario.rol en el login).
export const ROLES = ['Administrador', 'Cajero', 'Repositor'] as const;
export type Rol = (typeof ROLES)[number];
