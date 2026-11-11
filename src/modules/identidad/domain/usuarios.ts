import type { Transaccion } from "@/shared/dominio/contexto";

export interface FilaUsuario {
  id: string;
  correo: string;
  nombre: string;
  activo: boolean;
  roles: string[];
  fincas: { id: string; nombre: string }[];
  permisosExtra: string[];
  autorizoTratamiento: boolean;
}
export interface FilaRol { codigo: string; nombre: string; esExtension: boolean; permisos: string[] }
export interface FilaPermiso { codigo: string; descripcion: string }

export interface RepositorioUsuarios {
  listarUsuarios(tx: Transaccion, organizacionId: string): Promise<FilaUsuario[]>;
  listarRoles(tx: Transaccion): Promise<FilaRol[]>;
  listarPermisos(tx: Transaccion): Promise<FilaPermiso[]>;
  crearUsuario(tx: Transaccion, u: { organizacionId: string; correo: string; nombre: string; hash: string; autoriza: boolean }): Promise<string>;
  usuarioDeOrganizacion(tx: Transaccion, organizacionId: string, usuarioId: string): Promise<{ id: string; activo: boolean; roles: string[] } | null>;
  asignarRoles(tx: Transaccion, usuarioId: string, codigos: string[]): Promise<boolean>;
  asignarFincas(tx: Transaccion, organizacionId: string, usuarioId: string, fincaIds: string[]): Promise<boolean>;
  fijarActivo(tx: Transaccion, usuarioId: string, activo: boolean): Promise<void>;
  cambiarHash(tx: Transaccion, usuarioId: string, hash: string): Promise<void>;
  revocarSesiones(tx: Transaccion, usuarioId: string): Promise<void>;
  permisoExiste(tx: Transaccion, codigo: string): Promise<boolean>;
  otorgarPermisoExtra(tx: Transaccion, usuarioId: string, codigo: string): Promise<void>;
  revocarPermisoExtra(tx: Transaccion, usuarioId: string, codigo: string): Promise<void>;
  contarAdministradoresActivos(tx: Transaccion, organizacionId: string): Promise<number>;
}
