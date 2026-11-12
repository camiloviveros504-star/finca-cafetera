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
  pendiente: boolean; // invitación sin activar
  invitacionVigente: boolean;
}
export interface FilaRol { codigo: string; nombre: string; esExtension: boolean; permisos: string[] }
export interface FilaPermiso { codigo: string; descripcion: string }

export interface RepositorioUsuarios {
  listarUsuarios(tx: Transaccion, organizacionId: string, soloFincas?: readonly string[]): Promise<FilaUsuario[]>;
  fincasDeUsuario(tx: Transaccion, usuarioId: string): Promise<string[]>;
  listarRoles(tx: Transaccion, soloVisibles?: boolean): Promise<FilaRol[]>;
  listarPermisos(tx: Transaccion): Promise<FilaPermiso[]>;
  crearUsuario(tx: Transaccion, u: { organizacionId: string; correo: string; nombre: string; hash: string; autoriza: boolean }): Promise<string>;
  usuarioDeOrganizacion(tx: Transaccion, organizacionId: string, usuarioId: string): Promise<{ id: string; activo: boolean; roles: string[]; activada: boolean; correo: string } | null>;
  crearUsuarioPendiente(tx: Transaccion, u: { organizacionId: string; correo: string; nombre: string; hash: string }): Promise<string>;
  insertarInvitacion(tx: Transaccion, i: { organizacionId: string; usuarioId: string; tipo: "alta" | "restablecimiento"; tokenHash: string; expiraEn: Date; creadaPor: string }): Promise<void>;
  revocarInvitaciones(tx: Transaccion, usuarioId: string): Promise<void>;
  buscarInvitacion(tx: Transaccion, tokenHash: string): Promise<{ id: string; usuarioId: string; organizacionId: string; tipo: "alta" | "restablecimiento"; expiraEn: Date; usadaEn: Date | null; correo: string; nombre: string } | null>;
  marcarInvitacionUsada(tx: Transaccion, id: string): Promise<void>;
  activarUsuario(tx: Transaccion, usuarioId: string, hash: string, esAlta: boolean): Promise<void>;
  asignarRoles(tx: Transaccion, usuarioId: string, codigos: string[]): Promise<boolean>;
  asignarFincas(tx: Transaccion, organizacionId: string, usuarioId: string, fincaIds: string[]): Promise<boolean>;
  /** Suma una finca a las que ya tiene la cuenta (sin quitarle ninguna). Falso si la finca no es de la organización. */
  agregarFinca(tx: Transaccion, organizacionId: string, usuarioId: string, fincaId: string): Promise<boolean>;
  fijarActivo(tx: Transaccion, usuarioId: string, activo: boolean): Promise<void>;
  cambiarHash(tx: Transaccion, usuarioId: string, hash: string): Promise<void>;
  revocarSesiones(tx: Transaccion, usuarioId: string): Promise<void>;
  permisoExiste(tx: Transaccion, codigo: string): Promise<boolean>;
  otorgarPermisoExtra(tx: Transaccion, usuarioId: string, codigo: string): Promise<void>;
  revocarPermisoExtra(tx: Transaccion, usuarioId: string, codigo: string): Promise<void>;
  contarAdministradoresActivos(tx: Transaccion, organizacionId: string): Promise<number>;
}
