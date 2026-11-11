import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioFincasLotes } from "../domain/puertos";

export interface DependenciasFincasLotes {
  repo: RepositorioFincasLotes;
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

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const area = z.preprocess(vacio, z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Área inválida").optional());

const esquemaFinca = z.object({
  nombre: z.string().trim().min(3, "Indique el nombre").max(120),
  ubicacion: z.preprocess(vacio, z.string().trim().max(200).optional()),
  areaHa: area,
});

export async function crearFinca(deps: DependenciasFincasLotes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaFinca, cruda, "Revise los datos de la finca");
  await autorizar(deps.auditor, ctx, "finca:administrar", { accion: "finca.crear", entidad: "finca" });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearFinca(tx, { organizacionId: ctx.organizacionId, ...e, creadoPor: ctx.usuarioId });
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "finca.crear", entidad: "finca", entidadId: id, resultado: "ok", despues: { nombre: e.nombre }, ip: ctx.ip },
      tx,
    );
    return { id };
  });
}

const esquemaLote = z.object({
  fincaId: z.string().uuid(),
  codigo: z.string().trim().min(1, "Indique el código").max(20),
  nombre: z.string().trim().min(2, "Indique el nombre").max(120),
  areaHa: area,
  variedad: z.preprocess(vacio, z.string().trim().max(60).optional()),
  fechaSiembra: z.preprocess(vacio, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional()),
  numeroArboles: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(0).max(10_000_000).optional()),
});

export async function crearLote(deps: DependenciasFincasLotes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaLote, cruda, "Revise los datos del lote");
  await autorizar(deps.auditor, ctx, "lote:administrar", { accion: "lote.crear", entidad: "lote", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearLote(tx, { organizacionId: ctx.organizacionId, ...e, creadoPor: ctx.usuarioId });
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "lote.crear", entidad: "lote", entidadId: id, resultado: "ok", despues: { codigo: e.codigo }, ip: ctx.ip },
      tx,
    );
    return { id };
  });
}

export async function listarFincasYLotes(deps: DependenciasFincasLotes, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "lote:ver", { accion: "lote.listar", entidad: "lote" });
  return deps.uow.consultar(async (tx) => ({
    fincas: await deps.repo.listarFincas(tx, ctx.organizacionId, ctx.fincaIds),
    lotes: await deps.repo.listarLotes(tx, ctx.organizacionId, ctx.fincaIds),
  }));
}
