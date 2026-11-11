import type { ContextoUsuario } from "@/shared/dominio/contexto";

export interface UsuarioRegistrado {
  id: string;
  organizacionId: string;
  nombre: string;
  correo: string;
  passwordHash: string;
  activo: boolean;
}

export interface SesionActiva {
  contexto: Omit<ContextoUsuario, "ip">;
}

export interface RepositorioIdentidad {
  buscarUsuarioPorCorreo(correo: string): Promise<UsuarioRegistrado | null>;
  contarFallosPorCorreo(correoHash: string, desde: Date): Promise<number>;
  contarFallosPorIp(ip: string, desde: Date): Promise<number>;
  registrarIntento(correoHash: string, ip: string, exitoso: boolean): Promise<void>;
  crearSesion(tokenHash: string, usuarioId: string, expiraEn: Date, csrfToken: string): Promise<void>;
  buscarSesion(tokenHash: string): Promise<SesionActiva | null>;
  eliminarSesion(tokenHash: string): Promise<void>;
}

export interface Contrasenas {
  verificar(cifrada: string, contrasena: string): Promise<boolean>;
  /** Hash de relleno para igualar tiempos cuando el usuario no existe. */
  hashDeRelleno(): Promise<string>;
}
