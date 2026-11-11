/**
 * Alta de usuarios por invitación (todo parte del administrador): el administrador registra a la persona y define sus roles
 * y fincas; el sistema genera un enlace de UN solo uso con vencimiento, y la persona fija ella misma su contraseña. El
 * administrador nunca conoce ni escribe la contraseña de nadie. El mismo mecanismo sirve para restablecer una contraseña.
 *
 * Defensas: el token es aleatorio de 256 bits y solo se guarda su huella SHA-256; se consume dentro de una transacción con
 * bloqueo de fila (dos usos simultáneos no pasan); vence a las 72 horas; generar un enlace nuevo revoca los anteriores;
 * los intentos con enlaces inválidos cuentan contra el límite por IP del inicio de sesión; al activar o restablecer se
 * cierran las sesiones abiertas de esa cuenta; la auditoría nunca guarda el token ni la contraseña.
 */
import { z } from "zod";
import { sha256, tokenAleatorio } from "@/shared/aplicacion/cripto";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { problemaDeContrasena } from "@/shared/dominio/contrasena";
import { ErrorBloqueado, ErrorNoEncontrado, ErrorProhibido, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioUsuarios } from "../domain/usuarios";
import { MAX_FALLOS_POR_IP, VENTANA_BLOQUEO_MS } from "./sesiones";
import { ROLES_DE_EQUIPO, validarRolesYFincas } from "./usuarios";

export const DURACION_INVITACION_MS = 72 * 60 * 60 * 1000;

export interface DependenciasInvitaciones {
  repo: RepositorioUsuarios;
  /** Misma tabla de intentos que el inicio de sesión: un atacante no obtiene un segundo cupo de intentos. */
  acceso: { contarFallosPorIp(ip: string, desde: Date): Promise<number>; registrarIntento(correoHash: string, ip: string, exitoso: boolean): Promise<void> };
  cifrar: (contrasena: string) => Promise<string>;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
  ahora?: () => Date;
}

const uuid = z.string().uuid();
const esquemaInvitar = z.object({
  correo: z.string().trim().toLowerCase().email("Correo inválido").max(120),
  nombre: z.string().trim().min(3, "Indique el nombre").max(100),
  roles: z.array(z.string()).min(1, "Asigne al menos un rol"),
  fincaIds: z.array(uuid).default([]),
});

function validar<T extends z.ZodTypeAny>(esquema: T, entrada: unknown, mensaje: string): z.infer<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
  throw new ErrorValidacion(mensaje, campos);
}

/**
 * El administrador gestiona cualquier cuenta. El propietario solo puede invitar a su equipo (capataces y trabajadores) y
 * únicamente a fincas que él mismo tiene asignadas: nunca crea administradores ni propietarios ni entra a fincas ajenas.
 */
async function autorizarGestionDeCuentas(deps: DependenciasInvitaciones, ctx: ContextoUsuario, accion: string, roles: readonly string[], fincaIds: readonly string[]) {
  if (ctx.permisos.has("usuario:administrar")) return;
  await autorizar(deps.auditor, ctx, "usuario:invitar_equipo", { accion, entidad: "usuario" });
  const fueraDeAlcance = roles.some((r) => !ROLES_DE_EQUIPO.includes(r)) || fincaIds.some((f) => !ctx.fincaIds.includes(f)) || fincaIds.length === 0;
  if (fueraDeAlcance) {
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion, entidad: "usuario", resultado: "denegado", despues: { motivo: "fuera_de_alcance_del_propietario" }, ip: ctx.ip });
    throw new ErrorProhibido();
  }
}

export async function invitarUsuario(deps: DependenciasInvitaciones, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaInvitar, cruda, "Revise los datos del usuario");
  await autorizarGestionDeCuentas(deps, ctx, "usuario.invitar", e.roles, e.fincaIds);
  validarRolesYFincas(ctx, e.roles, e.fincaIds);
  const ahora = (deps.ahora ?? (() => new Date()))();
  const hashInutilizable = await deps.cifrar(tokenAleatorio(48)); // nadie conoce esta contraseña: no se puede iniciar sesión hasta activar
  return deps.uow.ejecutar(async (tx) => {
    let usuarioId: string;
    try {
      usuarioId = await deps.repo.crearUsuarioPendiente(tx, { organizacionId: ctx.organizacionId, correo: e.correo, nombre: e.nombre, hash: hashInutilizable });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorRegla("Ya existe un usuario con ese correo", "usuario_duplicado");
      throw error;
    }
    if (!(await deps.repo.asignarRoles(tx, usuarioId, e.roles))) throw new ErrorRegla("Algún rol no existe", "rol_invalido");
    if (e.fincaIds.length > 0 && !(await deps.repo.asignarFincas(tx, ctx.organizacionId, usuarioId, e.fincaIds))) throw new ErrorRegla("Alguna finca no pertenece a la organización", "finca_invalida");
    const token = tokenAleatorio(32);
    const expiraEn = new Date(ahora.getTime() + DURACION_INVITACION_MS);
    await deps.repo.insertarInvitacion(tx, { organizacionId: ctx.organizacionId, usuarioId, tipo: "alta", tokenHash: sha256(token), expiraEn, creadaPor: ctx.usuarioId });
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "usuario.invitar", entidad: "usuario", entidadId: usuarioId, resultado: "ok", despues: { roles: e.roles, fincas: e.fincaIds.length }, ip: ctx.ip }, tx);
    return { usuarioId, token, expiraEn };
  });
}

/** Genera un enlace nuevo (alta pendiente o restablecimiento) y revoca los anteriores de esa cuenta. */
export async function emitirEnlace(deps: DependenciasInvitaciones, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ usuarioId: uuid }), cruda, "Revise los datos");
  if (!ctx.permisos.has("usuario:administrar")) await autorizar(deps.auditor, ctx, "usuario:invitar_equipo", { accion: "usuario.enlace", entidad: "usuario" });
  const ahora = (deps.ahora ?? (() => new Date()))();
  return deps.uow.ejecutar(async (tx) => {
    const u = await deps.repo.usuarioDeOrganizacion(tx, ctx.organizacionId, e.usuarioId);
    if (!u) throw new ErrorNoEncontrado("Usuario");
    if (!ctx.permisos.has("usuario:administrar")) {
      // El propietario solo gestiona enlaces de su equipo: roles de equipo y fincas suyas.
      const fincas = await deps.repo.fincasDeUsuario(tx, u.id);
      if (u.roles.some((r) => !ROLES_DE_EQUIPO.includes(r)) || fincas.length === 0 || fincas.some((f) => !ctx.fincaIds.includes(f))) throw new ErrorNoEncontrado("Usuario");
    }
    const tipo = u.activada ? "restablecimiento" : "alta";
    await deps.repo.revocarInvitaciones(tx, u.id);
    const token = tokenAleatorio(32);
    const expiraEn = new Date(ahora.getTime() + DURACION_INVITACION_MS);
    await deps.repo.insertarInvitacion(tx, { organizacionId: ctx.organizacionId, usuarioId: u.id, tipo, tokenHash: sha256(token), expiraEn, creadaPor: ctx.usuarioId });
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "usuario.enlace", entidad: "usuario", entidadId: u.id, resultado: "ok", despues: { tipo }, ip: ctx.ip }, tx);
    return { token, expiraEn, tipo };
  });
}

async function exigirCupo(deps: DependenciasInvitaciones, ip: string, ahora: Date) {
  const fallos = await deps.acceso.contarFallosPorIp(ip, new Date(ahora.getTime() - VENTANA_BLOQUEO_MS));
  if (fallos >= MAX_FALLOS_POR_IP) throw new ErrorBloqueado();
}

const enmascarar = (correo: string) => {
  const [u, d] = correo.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(u.length - 2, 1))}@${d}`;
};

/** Para la pantalla de activación: dice si el enlace sirve, sin revelar nada si no sirve. */
export async function consultarInvitacion(deps: DependenciasInvitaciones, token: string, ip: string) {
  const ahora = (deps.ahora ?? (() => new Date()))();
  await exigirCupo(deps, ip, ahora);
  const inv = token.length >= 20 ? await deps.uow.ejecutar((tx) => deps.repo.buscarInvitacion(tx, sha256(token))) : null;
  if (!inv || inv.usadaEn || inv.expiraEn <= ahora) {
    await deps.acceso.registrarIntento(sha256(`enlace:${ip}`), ip, false);
    return { valida: false as const };
  }
  return { valida: true as const, tipo: inv.tipo, nombre: inv.nombre, correo: enmascarar(inv.correo) };
}

const esquemaActivar = z.object({
  token: z.string().min(20).max(200),
  contrasena: z.string().min(1, "Ingrese una contraseña").max(128),
  confirmacion: z.string(),
  aceptaTratamiento: z.boolean(),
});

export async function activarCuenta(deps: DependenciasInvitaciones, entrada: { token: string; contrasena: string; confirmacion: string; aceptaTratamiento: boolean; ip: string }) {
  const e = validar(esquemaActivar, entrada, "Revise los datos");
  const ahora = (deps.ahora ?? (() => new Date()))();
  await exigirCupo(deps, entrada.ip, ahora);
  return deps.uow.ejecutar(async (tx) => {
    const inv = await deps.repo.buscarInvitacion(tx, sha256(e.token)); // bloquea la fila: un solo uso aunque lleguen dos solicitudes
    if (!inv || inv.usadaEn || inv.expiraEn <= ahora) {
      await deps.acceso.registrarIntento(sha256(`enlace:${entrada.ip}`), entrada.ip, false);
      throw new ErrorRegla("El enlace no es válido o ya venció. Pida uno nuevo al administrador.", "enlace_invalido");
    }
    if (e.contrasena !== e.confirmacion) throw new ErrorValidacion("Las contraseñas no coinciden", { confirmacion: "No coincide" });
    const problema = problemaDeContrasena(e.contrasena, inv.correo);
    if (problema) throw new ErrorValidacion("Revise la contraseña", { contrasena: problema });
    const esAlta = inv.tipo === "alta";
    if (esAlta && !e.aceptaTratamiento) throw new ErrorValidacion("Debe aceptar el tratamiento de sus datos personales", { aceptaTratamiento: "Obligatorio" });
    const hash = await deps.cifrar(e.contrasena);
    await deps.repo.activarUsuario(tx, inv.usuarioId, hash, esAlta);
    await deps.repo.marcarInvitacionUsada(tx, inv.id);
    await deps.repo.revocarInvitaciones(tx, inv.usuarioId);
    await deps.repo.revocarSesiones(tx, inv.usuarioId); // si alguien tenía una sesión abierta con la contraseña anterior, se cierra
    await deps.auditor.registrar({ organizacionId: inv.organizacionId, usuarioId: inv.usuarioId, accion: esAlta ? "usuario.activar" : "usuario.restablecer", entidad: "usuario", entidadId: inv.usuarioId, resultado: "ok", ip: entrada.ip }, tx);
    return { correo: inv.correo, tipo: inv.tipo };
  });
}
