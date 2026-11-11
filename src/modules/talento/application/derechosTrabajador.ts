/**
 * Derechos del titular sobre los datos de un trabajador (Ley 1581 de 2012; Decreto 1377 de 2013, compilado en el Decreto
 * 1074 de 2015): conocer, rectificar y suprimir. La supresión anonimiza nombres, documento y teléfono, y conserva el
 * registro porque las liquidaciones y pagos son hechos económicos que deben seguir cuadrando. Si el trabajador tiene un
 * usuario de acceso, este se desactiva desde la administración de usuarios (el resultado lo informa).
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioDerechosTrabajador } from "../domain/derechos";

export interface DependenciasDerechosTrabajador {
  repo: RepositorioDerechosTrabajador;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export async function exportarDatosTrabajador(deps: DependenciasDerechosTrabajador, ctx: ContextoUsuario, trabajadorId: string) {
  await autorizar(deps.auditor, ctx, "datos_personales:gestionar", { accion: "trabajador.exportar", entidad: "trabajador" });
  return deps.uow.ejecutar(async (tx) => {
    const t = await deps.repo.obtener(tx, ctx.organizacionId, trabajadorId);
    if (!t) throw new ErrorNoEncontrado("Trabajador");
    const resumen = await deps.repo.resumenLaboral(tx, ctx.organizacionId, trabajadorId);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "trabajador.exportar", entidad: "trabajador", entidadId: trabajadorId, resultado: "ok", ip: ctx.ip }, tx);
    return {
      generadoEn: new Date().toISOString(),
      responsable: "Titular de la organización (responsable del tratamiento)",
      finalidad: t.finalidad,
      titular: { tipoDocumento: t.tipoDocumento, numeroDocumento: t.numeroDocumento, nombres: t.nombres, apellidos: t.apellidos, telefono: t.telefono },
      autorizacionEn: t.autorizoEn,
      anonimizadoEn: t.anonimizadoEn,
      tieneUsuarioDeAcceso: t.usuarioId !== null,
      resumenLaboral: resumen,
    };
  });
}

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const esquemaRectificar = z.object({
  trabajadorId: z.string().uuid(),
  nombres: z.string().trim().min(2, "Indique los nombres").max(80).optional(),
  apellidos: z.string().trim().min(2, "Indique los apellidos").max(80).optional(),
  telefono: z.preprocess(vacio, z.string().trim().max(20).nullable().optional()),
});

export async function rectificarTrabajador(deps: DependenciasDerechosTrabajador, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquemaRectificar.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos a rectificar", campos);
  }
  const { trabajadorId, ...campos } = r.data;
  await autorizar(deps.auditor, ctx, "trabajador:administrar", { accion: "trabajador.rectificar", entidad: "trabajador" });
  return deps.uow.ejecutar(async (tx) => {
    const t = await deps.repo.obtener(tx, ctx.organizacionId, trabajadorId);
    if (!t) throw new ErrorNoEncontrado("Trabajador");
    if (t.anonimizadoEn) throw new ErrorRegla("Los datos de este trabajador fueron suprimidos y no se pueden modificar", "trabajador_anonimizado");
    await deps.repo.actualizar(tx, ctx.organizacionId, trabajadorId, campos);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "trabajador.rectificar", entidad: "trabajador", entidadId: trabajadorId, resultado: "ok", despues: { camposModificados: Object.keys(campos).filter((k) => (campos as Record<string, unknown>)[k] !== undefined) }, ip: ctx.ip }, tx);
    return { ok: true };
  });
}

export async function anonimizarTrabajador(deps: DependenciasDerechosTrabajador, ctx: ContextoUsuario, cruda: unknown) {
  const e = z.object({ trabajadorId: z.string().uuid(), motivo: z.string().trim().min(10, "Indique el motivo de la solicitud (mínimo 10 caracteres)").max(300) }).safeParse(cruda);
  if (!e.success) throw new ErrorValidacion("Revise los datos de la supresión", { motivo: e.error.issues[0]?.message ?? "Inválido" });
  await autorizar(deps.auditor, ctx, "datos_personales:gestionar", { accion: "trabajador.anonimizar", entidad: "trabajador" });
  return deps.uow.ejecutar(async (tx) => {
    const t = await deps.repo.obtener(tx, ctx.organizacionId, e.data.trabajadorId);
    if (!t) throw new ErrorNoEncontrado("Trabajador");
    if (t.anonimizadoEn) throw new ErrorRegla("Los datos de este trabajador ya fueron suprimidos", "trabajador_anonimizado");
    await deps.repo.anonimizar(tx, ctx.organizacionId, e.data.trabajadorId);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "trabajador.anonimizar", entidad: "trabajador", entidadId: e.data.trabajadorId, resultado: "ok", despues: { motivo: e.data.motivo }, ip: ctx.ip }, tx);
    return { ok: true, usuarioVinculadoPorDesactivar: t.usuarioId !== null };
  });
}
