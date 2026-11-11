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
const contrasena = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras y números");
const auditar = (deps: DependenciasUsuarios, ctx: ContextoUsuario, tx: Parameters<Auditor["registrar"]>[1], accion: string, usuarioId: string, despues: unknown) =>
  deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion, entidad: "usuario", entidadId: usuarioId, resultado: "ok", despues, ip: ctx.ip }, tx);

export async function listarUsuarios(deps: DependenciasUsuarios, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "usuario:ver", { accion: "usuario.listar", entidad: "usuario" });
  return deps.uow.consultar(async (tx) => ({
    usuarios: await deps.repo.listarUsuarios(tx, ctx.organizacionId),
    roles: await deps.repo.listarRoles(tx),
    permisos: await deps.repo.listarPermisos(tx),
  }));
}

const esquemaCrear = z.object({
  correo: z.string().trim().toLowerCase().email("Correo inválido").max(120),
  nombre: z.string().trim().min(3, "Indique el nombre").max(100),
  contrasena,
  roles: z.array(z.string()).min(1, "Asigne al menos un rol"),
  fincaIds: z.array(uuid).min(1, "Asigne al menos una finca"),
  autorizaTratamiento: z.literal(true, { message: "Debe confirmar la autorización de tratamiento de datos personales" }),
});

export async function crearUsuario(deps: DependenciasUsuarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaCrear, cruda, "Revise los datos del usuario");
  await autorizar(deps.auditor, ctx, "usuario:administrar", { accion: "usuario.crear", entidad: "usuario" });
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
    if (!(await deps.repo.asignarFincas(tx, ctx.organizacionId, id, e.fincaIds))) throw new ErrorRegla("Alguna finca no pertenece a la organización", "finca_invalida");
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
  const e = validar(z.object({ usuarioId: uuid, roles: z.array(z.string()).min(1, "Asigne al menos un rol"), fincaIds: z.array(uuid).min(1, "Asigne al menos una finca") }), cruda, "Revise los datos");
  await autorizar(deps.auditor, ctx, "usuario:administrar", { accion: "usuario.asignar", entidad: "usuario" });
  return deps.uow.ejecutar(async (tx) => {
    const u = await cargarUsuario(deps, ctx, tx, e.usuarioId);
    if (u.id === ctx.usuarioId && u.roles.includes("administrador") && !e.roles.includes("administrador")) throw new ErrorRegla("No puede quitarse a sí mismo el rol de administrador", "autoexclusion");
    if (u.roles.includes("administrador") && !e.roles.includes("administrador") && (await deps.repo.contarAdministradoresActivos(tx, ctx.organizacionId)) <= 1) throw new ErrorRegla("La organización debe conservar al menos un administrador", "ultimo_administrador");
    if (!(await deps.repo.asignarRoles(tx, e.usuarioId, e.roles))) throw new ErrorRegla("Algún rol no existe", "rol_invalido");
    if (!(await deps.repo.asignarFincas(tx, ctx.organizacionId, e.usuarioId, e.fincaIds))) throw new ErrorRegla("Alguna finca no pertenece a la organización", "finca_invalida");
    await deps.repo.revocarSesiones(tx, e.usuarioId);
    await auditar(deps, ctx, tx, "usuario.asignar", e.usuarioId, { antes: u.roles, roles: e.roles, fincas: e.fincaIds.length });
    return { ok: true };
  });
}

export async function cambiarEstadoUsuario(deps: DependenciasUsuarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ usuarioId: uuid, activo: z.boolean() }), cruda, "Revise los datos");
  await autorizar(deps.auditor, ctx, "usuario:administrar", { accion: "usuario.estado", entidad: "usuario" });
  return deps.uow.ejecutar(async (tx) => {
    const u = await cargarUsuario(deps, ctx, tx, e.usuarioId);
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
