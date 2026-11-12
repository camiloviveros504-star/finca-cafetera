/**
 * Administración de usuarios, roles y permisos (prompt §7). Reglas: la contraseña se guarda con Argon2id; los cambios de
 * rol, fincas, permisos o estado cierran las sesiones del usuario para que apliquen de inmediato; nadie puede dejar la
 * organización sin administrador ni quitarse a sí mismo el acceso.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { esquemaContrasena } from "@/shared/dominio/contrasena";
import type { RepositorioUsuarios } from "../domain/usuarios";

export interface DependenciasUsuarios {
  repo: RepositorioUsuarios;
  cifrar: (contrasena: string) => Promise<string>;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

function validar<T extends z.ZodTypeAny>(esquema: T, entrada: unknown, mensaje: string): z.infer<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
  throw new ErrorValidacion(mensaje, campos);
}
const uuid = z.string().uuid();
/** Roles que un propietario puede asignar a su equipo; el resto (administrador, propietario) los asigna el administrador. */
export const ROLES_DE_EQUIPO = ["capataz", "trabajador"];

/**
 * Reglas de quién crea qué cuenta (también se aplican al invitar):
 * - El administrador de la plataforma NO crea capataces ni trabajadores: esos los crea el dueño de cada finca.
 * - El administrador no asigna fincas: el propietario nace sin fincas y crea las suyas (Mis fincas).
 * - El capataz y el trabajador necesitan al menos una finca de su propietario.
 */
export function validarRolesYFincas(ctx: ContextoUsuario, roles: readonly string[], fincaIds: readonly string[]) {
  if (ctx.permisos.has("usuario:administrar") && roles.some((r) => ROLES_DE_EQUIPO.includes(r))) {
    throw new ErrorRegla("Las cuentas de capataz y de trabajador las crea el propietario de cada finca", "rol_de_equipo");
  }
  if (ctx.permisos.has("usuario:administrar") && fincaIds.length > 0) {
    throw new ErrorRegla("Las fincas las crea cada propietario desde su cuenta; el administrador no las asigna", "fincas_del_propietario");
  }
  if (roles.some((r) => ROLES_DE_EQUIPO.includes(r)) && fincaIds.length === 0) throw new ErrorValidacion("Asigne al menos una finca", { fincaIds: "Asigne al menos una finca" });
}
const contrasena = esquemaContrasena();

/** Una cuenta de equipo (capataz o trabajador) pertenece al propietario de sus fincas y solo él la gestiona. */
export const esCuentaDeEquipo = (roles: readonly string[]) => roles.length > 0 && roles.every((r) => ROLES_DE_EQUIPO.includes(r));
const ERROR_CUENTA_DE_EQUIPO = () => new ErrorRegla("Las cuentas de capataz y de trabajador las gestiona su propietario", "cuenta_de_equipo");

/** Cuántos capataces y trabajadores tiene un propietario: los que trabajan en alguna de sus fincas. */
export interface EquipoDePropietario { capataces: number; trabajadores: number }
const auditar = (deps: DependenciasUsuarios, ctx: ContextoUsuario, tx: Parameters<Auditor["registrar"]>[1], accion: string, usuarioId: string, despues: unknown) =>
  deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion, entidad: "usuario", entidadId: usuarioId, resultado: "ok", despues, ip: ctx.ip }, tx);

export async function listarUsuarios(deps: DependenciasUsuarios, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "usuario:ver", { accion: "usuario.listar", entidad: "usuario" });
  // El administrador ve todas las cuentas; el propietario, solo el equipo (capataces y trabajadores) de sus fincas.
  const global = ctx.permisos.has("usuario:administrar");
  return deps.uow.consultar(async (tx) => {
    const todas = await deps.repo.listarUsuarios(tx, ctx.organizacionId, global ? undefined : ctx.fincaIds);
    const equipo = todas.filter((u) => esCuentaDeEquipo(u.roles));
    const equipoDe = (fincas: { id: string }[]): EquipoDePropietario => {
      const ids = new Set(fincas.map((f) => f.id));
      const suyos = equipo.filter((m) => m.fincas.some((f) => ids.has(f.id)));
      return { capataces: suyos.filter((m) => m.roles.includes("capataz")).length, trabajadores: suyos.filter((m) => m.roles.includes("trabajador")).length };
    };
    return {
    // Administrador: propietarios y administradores, y de cada propietario solo cuántos capataces y trabajadores tiene.
    // Propietario: solo su equipo (capataces y trabajadores de sus fincas), ni él mismo ni otros dueños.
    usuarios: global
      ? todas.filter((u) => !esCuentaDeEquipo(u.roles)).map((u) => ({ ...u, equipo: u.roles.includes("propietario") ? equipoDe(u.fincas) : undefined }))
      : equipo.filter((u) => u.id !== ctx.usuarioId).map((u) => ({ ...u, equipo: undefined as EquipoDePropietario | undefined })),
    roles: (await deps.repo.listarRoles(tx, true)).filter((r) => (global ? !ROLES_DE_EQUIPO.includes(r.codigo) : ROLES_DE_EQUIPO.includes(r.codigo))),
    permisos: await deps.repo.listarPermisos(tx),
    };
  });
}

const esquemaCrear = z.object({
  correo: z.string().trim().toLowerCase().email("Correo inválido").max(120),
  nombre: z.string().trim().min(3, "Indique el nombre").max(100),
  contrasena,
  roles: z.array(z.string()).min(1, "Asigne al menos un rol"),
  fincaIds: z.array(uuid).default([]),
  autorizaTratamiento: z.literal(true, { message: "Debe confirmar la autorización de tratamiento de datos personales" }),
});

export async function crearUsuario(deps: DependenciasUsuarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaCrear, cruda, "Revise los datos del usuario");
  await autorizar(deps.auditor, ctx, "usuario:administrar", { accion: "usuario.crear", entidad: "usuario" });
  validarRolesYFincas(ctx, e.roles, e.fincaIds);
  const hash = await deps.cifrar(e.contrasena);
  return deps.uow.ejecutar(async (tx) => {
    let id: string;
    try {
      id = await deps.repo.crearUsuario(tx, { organizacionId: ctx.organizacionId, correo: e.correo, nombre: e.nombre, hash, autoriza: true });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorRegla("Ya existe un usuario con ese correo", "usuario_duplicado");
      throw error;
    }
    if (!(await deps.repo.asignarRoles(tx, id, e.roles))) throw new ErrorRegla("Algún rol no existe", "rol_invalido");
    if (e.fincaIds.length > 0 && !(await deps.repo.asignarFincas(tx, ctx.organizacionId, id, e.fincaIds))) throw new ErrorRegla("Alguna finca no pertenece a la organización", "finca_invalida");
    await auditar(deps, ctx, tx, "usuario.crear", id, { roles: e.roles, fincas: e.fincaIds.length }); // sin correo ni contraseña en la auditoría
    return { id };
  });
}

async function cargarUsuario(deps: DependenciasUsuarios, ctx: ContextoUsuario, tx: Parameters<RepositorioUsuarios["usuarioDeOrganizacion"]>[0], usuarioId: string) {
  const u = await deps.repo.usuarioDeOrganizacion(tx, ctx.organizacionId, usuarioId);
  if (!u) throw new ErrorNoEncontrado("Usuario");
  return u;
}

export async function asignarRolesYFincas(deps: DependenciasUsuarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ usuarioId: uuid, roles: z.array(z.string()).min(1, "Asigne al menos un rol"), fincaIds: z.array(uuid).default([]) }), cruda, "Revise los datos");
  const esAdministrador = ctx.permisos.has("usuario:administrar");
  await autorizar(deps.auditor, ctx, esAdministrador ? "usuario:administrar" : "usuario:invitar_equipo", { accion: "usuario.asignar", entidad: "usuario" });
  validarRolesYFincas(ctx, e.roles, e.fincaIds);
  return deps.uow.ejecutar(async (tx) => {
    const u = await cargarUsuario(deps, ctx, tx, e.usuarioId);
    if (esAdministrador && esCuentaDeEquipo(u.roles)) throw ERROR_CUENTA_DE_EQUIPO();
    if (!esAdministrador) {
      // El propietario solo reorganiza a su propio equipo, y solo entre sus fincas.
      const actuales = await deps.repo.fincasDeUsuario(tx, u.id);
      const fuera = u.roles.some((r) => !ROLES_DE_EQUIPO.includes(r)) || e.roles.some((r) => !ROLES_DE_EQUIPO.includes(r)) || actuales.some((f) => !ctx.fincaIds.includes(f)) || e.fincaIds.some((f) => !ctx.fincaIds.includes(f));
      if (fuera) throw new ErrorNoEncontrado("Usuario");
    }
    if (u.id === ctx.usuarioId && u.roles.includes("administrador") && !e.roles.includes("administrador")) throw new ErrorRegla("No puede quitarse a sí mismo el rol de administrador", "autoexclusion");
    if (u.roles.includes("administrador") && !e.roles.includes("administrador") && (await deps.repo.contarAdministradoresActivos(tx, ctx.organizacionId)) <= 1) throw new ErrorRegla("La organización debe conservar al menos un administrador", "ultimo_administrador");
    if (!(await deps.repo.asignarRoles(tx, e.usuarioId, e.roles))) throw new ErrorRegla("Algún rol no existe", "rol_invalido");
    // El administrador solo cambia el rol: las fincas de un propietario son las que él creó.
    if (!esAdministrador && !(await deps.repo.asignarFincas(tx, ctx.organizacionId, e.usuarioId, e.fincaIds))) throw new ErrorRegla("Alguna finca no pertenece a la organización", "finca_invalida");
    await deps.repo.revocarSesiones(tx, e.usuarioId);
    await auditar(deps, ctx, tx, "usuario.asignar", e.usuarioId, { antes: u.roles, roles: e.roles, fincas: e.fincaIds.length });
    return { ok: true };
  });
}

export async function cambiarEstadoUsuario(deps: DependenciasUsuarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ usuarioId: uuid, activo: z.boolean() }), cruda, "Revise los datos");
  const esAdministrador = ctx.permisos.has("usuario:administrar");
  await autorizar(deps.auditor, ctx, esAdministrador ? "usuario:administrar" : "usuario:invitar_equipo", { accion: "usuario.estado", entidad: "usuario" });
  return deps.uow.ejecutar(async (tx) => {
    const u = await cargarUsuario(deps, ctx, tx, e.usuarioId);
    if (esAdministrador && esCuentaDeEquipo(u.roles)) throw ERROR_CUENTA_DE_EQUIPO();
    if (!esAdministrador) {
      const fincas = await deps.repo.fincasDeUsuario(tx, u.id);
      if (!esCuentaDeEquipo(u.roles) || fincas.length === 0 || fincas.some((f) => !ctx.fincaIds.includes(f))) throw new ErrorNoEncontrado("Usuario");
    }
    if (!u.activada) throw new ErrorRegla("La cuenta aún no fue activada por la persona; genere un nuevo enlace en vez de cambiar su estado", "cuenta_pendiente");
    if (!e.activo) {
      if (u.id === ctx.usuarioId) throw new ErrorRegla("No puede desactivar su propio usuario", "autoexclusion");
      if (u.roles.includes("administrador") && (await deps.repo.contarAdministradoresActivos(tx, ctx.organizacionId)) <= 1) throw new ErrorRegla("La organización debe conservar al menos un administrador", "ultimo_administrador");
    }
    await deps.repo.fijarActivo(tx, e.usuarioId, e.activo);
    if (!e.activo) await deps.repo.revocarSesiones(tx, e.usuarioId);
    await auditar(deps, ctx, tx, "usuario.estado", e.usuarioId, { activo: e.activo }); // no se borra: el historial conserva al usuario
    return { ok: true };
  });
}

export async function restablecerContrasena(deps: DependenciasUsuarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ usuarioId: uuid, contrasena }), cruda, "Revise la contraseña");
  await autorizar(deps.auditor, ctx, "usuario:administrar", { accion: "usuario.contrasena", entidad: "usuario" });
  const hash = await deps.cifrar(e.contrasena);
  return deps.uow.ejecutar(async (tx) => {
    await cargarUsuario(deps, ctx, tx, e.usuarioId);
    await deps.repo.cambiarHash(tx, e.usuarioId, hash);
    await deps.repo.revocarSesiones(tx, e.usuarioId);
    await auditar(deps, ctx, tx, "usuario.contrasena", e.usuarioId, {}); // nunca se registra la contraseña
    return { ok: true };
  });
}

export async function cambiarPermisoExtra(deps: DependenciasUsuarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ usuarioId: uuid, permiso: z.string().min(3), otorgar: z.boolean() }), cruda, "Revise los datos");
  await autorizar(deps.auditor, ctx, "usuario:administrar", { accion: "usuario.permiso_extra", entidad: "usuario" });
  return deps.uow.ejecutar(async (tx) => {
    await cargarUsuario(deps, ctx, tx, e.usuarioId);
    if (!(await deps.repo.permisoExiste(tx, e.permiso))) throw new ErrorRegla("El permiso no existe", "permiso_invalido");
    if (e.otorgar) await deps.repo.otorgarPermisoExtra(tx, e.usuarioId, e.permiso);
    else await deps.repo.revocarPermisoExtra(tx, e.usuarioId, e.permiso);
    await deps.repo.revocarSesiones(tx, e.usuarioId);
    await auditar(deps, ctx, tx, "usuario.permiso_extra", e.usuarioId, { permiso: e.permiso, otorgado: e.otorgar });
    return { ok: true };
  });
}

export type { FilaPermiso, FilaRol, FilaUsuario } from "../domain/usuarios";
