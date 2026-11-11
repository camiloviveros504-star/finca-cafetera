/**
 * Control de plagas y enfermedades por lote. Se reporta el problema con una descripción para tratarlo y se le hace
 * seguimiento con fecha, nota y estado (en tratamiento, mejorando, controlada). Un seguimiento puede ligarse a la fumigación
 * con que se trató, siempre que sea del mismo lote. Si el problema vuelve, el caso se reabre y conserva su historial.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { ESTADOS_CASO, TIPOS_PLAGA, type RepositorioCasosSanitarios } from "../domain/casosSanitarios";

export interface DependenciasCasosSanitarios {
  repo: RepositorioCasosSanitarios;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

function validar<T extends z.ZodTypeAny>(esquema: T, entrada: unknown, mensaje: string): z.infer<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
  throw new ErrorValidacion(mensaje, campos);
}

const esquemaCaso = z.object({
  loteId: z.string().uuid({ message: "Seleccione el lote" }),
  tipo: z.enum(TIPOS_PLAGA, { message: "Seleccione la plaga o enfermedad" }),
  otroNombre: z.preprocess(vacio, z.string().trim().min(3, "Indique cuál").max(80).optional()),
  severidad: z.enum(["baja", "media", "alta"], { message: "Severidad inválida" }),
  afectacionPct: z.preprocess(vacio, z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Porcentaje inválido").optional()),
  descripcion: z.string().trim().min(5, "Describa lo que encontró y cómo tratarlo").max(1000),
  fecha,
  claveIdempotencia: z.string().min(8).max(100),
});

export async function reportarCasoSanitario(deps: DependenciasCasosSanitarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaCaso, cruda, "Revise el reporte");
  if (e.tipo === "otra" && !e.otroNombre) throw new ErrorValidacion("Indique cuál es el problema", { otroNombre: "Obligatorio" });
  if (e.afectacionPct !== undefined && Number(e.afectacionPct) > 100) throw new ErrorValidacion("El porcentaje no puede superar 100", { afectacionPct: "Inválido" });
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha no puede ser futura", { fecha: "Fecha futura" });
  await autorizar(deps.auditor, ctx, "inspeccion:registrar", { accion: "plaga.reportar", entidad: "caso_sanitario" });
  return deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.buscarPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previo) return { id: previo, repetido: true };
    const lote = await deps.repo.loteDeOrganizacion(tx, ctx.organizacionId, e.loteId);
    if (!lote || !ctx.fincaIds.includes(lote.fincaId)) throw new ErrorNoEncontrado("Lote");
    const id = await deps.repo.crear(tx, {
      organizacionId: ctx.organizacionId, fincaId: lote.fincaId, loteId: e.loteId, tipo: e.tipo, otroNombre: e.tipo === "otra" ? e.otroNombre : undefined,
      severidad: e.severidad, afectacionPct: e.afectacionPct, descripcion: e.descripcion, detectadoEn: e.fecha, clave: e.claveIdempotencia, creadoPor: ctx.usuarioId,
    });
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "plaga.reportar", entidad: "caso_sanitario", entidadId: id, resultado: "ok", despues: { tipo: e.tipo, severidad: e.severidad, loteId: e.loteId }, ip: ctx.ip }, tx);
    return { id, repetido: false };
  });
}

const esquemaSeguimiento = z.object({
  casoId: z.string().uuid(),
  estado: z.enum(ESTADOS_CASO, { message: "Estado inválido" }),
  nota: z.string().trim().min(3, "Escriba qué se hizo o qué se observó").max(1000),
  fecha,
  aplicacionId: z.preprocess(vacio, z.string().uuid().optional()),
});

export async function registrarSeguimientoCaso(deps: DependenciasCasosSanitarios, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaSeguimiento, cruda, "Revise el seguimiento");
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha no puede ser futura", { fecha: "Fecha futura" });
  await autorizar(deps.auditor, ctx, "inspeccion:registrar", { accion: "plaga.seguimiento", entidad: "caso_sanitario" });
  return deps.uow.ejecutar(async (tx) => {
    const caso = await deps.repo.bloquear(tx, ctx.organizacionId, e.casoId);
    if (!caso || !ctx.fincaIds.includes(caso.fincaId)) throw new ErrorNoEncontrado("Caso");
    if (e.fecha < caso.detectadoEn) throw new ErrorValidacion("La fecha no puede ser anterior a la detección", { fecha: "Anterior a la detección" });
    if (e.aplicacionId && !(await deps.repo.aplicacionDelLote(tx, ctx.organizacionId, e.aplicacionId, caso.loteId))) {
      throw new ErrorRegla("Esa aplicación no se hizo en este lote", "aplicacion_de_otro_lote");
    }
    await deps.repo.agregarSeguimiento(tx, { organizacionId: ctx.organizacionId, casoId: caso.id, fecha: e.fecha, estado: e.estado, nota: e.nota, aplicacionId: e.aplicacionId, registradoPor: ctx.usuarioId });
    const reabierto = caso.estado === "controlado" && e.estado !== "controlado";
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: reabierto ? "plaga.reabrir" : "plaga.seguimiento", entidad: "caso_sanitario", entidadId: caso.id, resultado: "ok", antes: { estado: caso.estado }, despues: { estado: e.estado }, ip: ctx.ip }, tx);
    return { estado: e.estado, reabierto };
  });
}

export async function listarCasosSanitarios(deps: DependenciasCasosSanitarios, ctx: ContextoUsuario, opciones: { soloAbiertos?: boolean } = {}) {
  await autorizar(deps.auditor, ctx, "inspeccion:ver", { accion: "plaga.listar", entidad: "caso_sanitario" });
  return deps.uow.consultar((tx) => deps.repo.listar(tx, ctx.organizacionId, ctx.fincaIds, opciones.soloAbiertos ?? false));
}

export { NOMBRE_ESTADO, NOMBRE_PLAGA, TIPOS_PLAGA, ESTADOS_CASO, type CasoSanitario, type EstadoCaso, type TipoPlaga } from "../domain/casosSanitarios";
