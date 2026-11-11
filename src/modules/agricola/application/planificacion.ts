/**
 * Planificación agrícola (extensión 5): actividades programadas (floración, fertilización, sombrío, arvenses, plagas,
 * enfermedades, renovación) y proyección de cosechas contrastada con lo cosechado realmente.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { ErrorNoEncontrado, ErrorProhibido, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { auditar, cantidadTxt, clave, fecha, uuid, validar, vacio, type DependenciasAgricola } from "./comun";

const esquemaActividad = z.object({
  fincaId: uuid,
  loteId: z.preprocess(vacio, uuid.optional()),
  tipo: z.enum(["floracion", "fertilizacion", "sombrio", "arvenses", "plagas", "enfermedades", "renovacion", "cosecha", "otra"], { message: "Tipo de actividad inválido" }),
  titulo: z.string().trim().min(3, "Indique el título").max(120),
  fecha,
  claveIdempotencia: clave,
});

export async function programarActividad(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaActividad, cruda, "Revise los datos de la actividad");
  await autorizar(deps.auditor, ctx, "planificacion:administrar", { accion: "actividad.programar", entidad: "actividad_programada", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const previa = await deps.repo.buscarActividadPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previa) return { id: previa, repetida: true };
    if (e.loteId && !(await deps.repo.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, e.fincaId))) throw new ErrorRegla("El lote no pertenece a la finca indicada", "lote_invalido");
    const id = await deps.repo.insertarActividad(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, loteId: e.loteId, tipo: e.tipo, titulo: e.titulo, fecha: e.fecha, clave: e.claveIdempotencia, creadoPor: ctx.usuarioId });
    await auditar(deps, ctx, tx, "actividad.programar", "actividad_programada", id, { tipo: e.tipo, fecha: e.fecha });
    return { id, repetida: false };
  });
}

const esquemaCierre = z.object({ actividadId: uuid, estado: z.enum(["completada", "cancelada"]), resultado: z.preprocess(vacio, z.string().trim().max(300).optional()) });

export async function cerrarActividad(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaCierre, cruda, "Revise los datos del cierre");
  await autorizar(deps.auditor, ctx, "planificacion:administrar", { accion: "actividad.cerrar", entidad: "actividad_programada" });
  return deps.uow.ejecutar(async (tx) => {
    const r = await deps.repo.cerrarActividad(tx, { organizacionId: ctx.organizacionId, id: e.actividadId, estado: e.estado, fechaCierre: fechaColombia(), resultado: e.resultado });
    if (!r) throw new ErrorNoEncontrado("Actividad programada");
    if (!ctx.fincaIds.includes(r.fincaId)) throw new ErrorProhibido(); // se revierte el cierre
    await auditar(deps, ctx, tx, "actividad.cerrar", "actividad_programada", e.actividadId, { estado: e.estado });
    return { estado: e.estado };
  });
}

export async function listarActividades(deps: DependenciasAgricola, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "planificacion:ver", { accion: "actividad.listar", entidad: "actividad_programada" });
  return deps.uow.consultar((tx) => deps.repo.listarActividades(tx, ctx.organizacionId, ctx.fincaIds, fechaColombia()));
}

const esquemaProyeccion = z.object({ fincaId: uuid, loteId: uuid, desde: fecha, hasta: fecha, estimadoKg: cantidadTxt, nota: z.preprocess(vacio, z.string().trim().max(300).optional()), claveIdempotencia: clave });

export async function registrarProyeccion(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaProyeccion, cruda, "Revise los datos de la proyección");
  if (e.hasta < e.desde) throw new ErrorValidacion("El período es inválido", { hasta: "Debe ser posterior al inicio" });
  if (aEscala(e.estimadoKg, ESCALA_CANTIDAD) <= 0n) throw new ErrorValidacion("La cantidad estimada debe ser mayor que cero", { estimadoKg: "Inválida" });
  await autorizar(deps.auditor, ctx, "planificacion:administrar", { accion: "proyeccion.registrar", entidad: "proyeccion_cosecha", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const previa = await deps.repo.buscarProyeccionPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previa) return { id: previa, repetida: true };
    if (!(await deps.repo.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, e.fincaId))) throw new ErrorRegla("El lote no pertenece a la finca indicada", "lote_invalido");
    const id = await deps.repo.insertarProyeccion(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, loteId: e.loteId, desde: e.desde, hasta: e.hasta, estimadoKg: e.estimadoKg, nota: e.nota, clave: e.claveIdempotencia, creadoPor: ctx.usuarioId });
    await auditar(deps, ctx, tx, "proyeccion.registrar", "proyeccion_cosecha", id, { estimadoKg: e.estimadoKg });
    return { id, repetida: false };
  });
}

export async function listarProyecciones(deps: DependenciasAgricola, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "planificacion:ver", { accion: "proyeccion.listar", entidad: "proyeccion_cosecha" });
  return deps.uow.consultar((tx) => deps.repo.listarProyecciones(tx, ctx.organizacionId, ctx.fincaIds));
}
