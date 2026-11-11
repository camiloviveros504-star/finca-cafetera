import { z } from "zod";
import type { Auditor } from "@/shared/aplicacion/puertos";
import { sha256, tokenAleatorio } from "@/shared/aplicacion/cripto";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorBloqueado, ErrorCredenciales, ErrorNoAutenticado, ErrorValidacion } from "@/shared/dominio/errores";
import type { Contrasenas, RepositorioIdentidad } from "../domain/puertos";

/** Reglas de QA-06: bloqueo tras 5 fallos en 15 minutos, por 15 minutos. */
export const MAX_FALLOS_POR_CUENTA = 5;
export const MAX_FALLOS_POR_IP = 20;
export const VENTANA_BLOQUEO_MS = 15 * 60 * 1000;
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

const esquemaLogin = z.object({
  correo: z.string().trim().min(3).max(200),
  contrasena: z.string().min(1).max(200),
});

export interface DependenciasSesion {
  repo: RepositorioIdentidad;
  contrasenas: Contrasenas;
  auditor: Auditor;
  ahora?: () => Date;
}

export interface SesionIniciada {
  token: string;
  csrfToken: string;
  expiraEn: Date;
}

export async function iniciarSesion(
  deps: DependenciasSesion,
  entrada: { correo: string; contrasena: string; ip: string },
): Promise<SesionIniciada> {
  const analizado = esquemaLogin.safeParse(entrada);
  if (!analizado.success) throw new ErrorValidacion("Ingrese su correo y contraseña");
  const ahora = (deps.ahora ?? (() => new Date()))();
  const correo = analizado.data.correo.toLowerCase();
  const correoHash = sha256(correo);
  const desde = new Date(ahora.getTime() - VENTANA_BLOQUEO_MS);

  const [fallosCuenta, fallosIp] = await Promise.all([
    deps.repo.contarFallosPorCorreo(correoHash, desde),
    deps.repo.contarFallosPorIp(entrada.ip, desde),
  ]);
  if (fallosCuenta >= MAX_FALLOS_POR_CUENTA || fallosIp >= MAX_FALLOS_POR_IP) {
    await deps.auditor.registrar({
      organizacionId: null,
      usuarioId: null,
      accion: "sesion.iniciar",
      entidad: "sesion",
      resultado: "denegado",
      despues: { motivo: "bloqueo_por_intentos" },
      ip: entrada.ip,
    });
    throw new ErrorBloqueado();
  }

  const usuario = await deps.repo.buscarUsuarioPorCorreo(correo);
  // Se verifica siempre una contraseña (real o de relleno) para no revelar si el usuario existe.
  const cifrada = usuario?.passwordHash ?? (await deps.contrasenas.hashDeRelleno());
  const coincide = await deps.contrasenas.verificar(cifrada, analizado.data.contrasena);

  if (!usuario || !usuario.activo || !coincide) {
    await deps.repo.registrarIntento(correoHash, entrada.ip, false);
    await deps.auditor.registrar({
      organizacionId: usuario?.organizacionId ?? null,
      usuarioId: usuario?.id ?? null,
      accion: "sesion.iniciar",
      entidad: "sesion",
      resultado: "denegado",
      despues: { motivo: "credenciales" },
      ip: entrada.ip,
    });
    throw new ErrorCredenciales();
  }

  await deps.repo.registrarIntento(correoHash, entrada.ip, true);
  const token = tokenAleatorio();
  const csrfToken = tokenAleatorio(16);
  const expiraEn = new Date(ahora.getTime() + DURACION_SESION_MS);
  await deps.repo.crearSesion(sha256(token), usuario.id, expiraEn, csrfToken);
  await deps.auditor.registrar({
    organizacionId: usuario.organizacionId,
    usuarioId: usuario.id,
    accion: "sesion.iniciar",
    entidad: "sesion",
    resultado: "ok",
    ip: entrada.ip,
  });
  return { token, csrfToken, expiraEn };
}

/** Devuelve el contexto del usuario autenticado o lanza ErrorNoAutenticado. */
export async function obtenerContexto(
  deps: Pick<DependenciasSesion, "repo">,
  token: string | undefined,
  ip: string,
): Promise<ContextoUsuario> {
  if (!token) throw new ErrorNoAutenticado();
  const sesion = await deps.repo.buscarSesion(sha256(token));
  if (!sesion) throw new ErrorNoAutenticado();
  return { ...sesion.contexto, ip };
}

export async function cerrarSesion(deps: Pick<DependenciasSesion, "repo">, token: string | undefined): Promise<void> {
  if (token) await deps.repo.eliminarSesion(sha256(token));
}
