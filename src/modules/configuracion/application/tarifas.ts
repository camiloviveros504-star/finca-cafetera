import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNegocio, ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import type { FilaTarifa, RepositorioTarifas } from "../domain/puertos";

export interface DependenciasTarifas {
  repo: RepositorioTarifas;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const esquema = z.object({
  tarifaId: z.string().uuid(),
  valor: z.string().regex(/^\d{1,11}(\.\d{1,2})?$/, "Valor inválido (máximo 2 decimales)"),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

/**
 * QA-12: una nueva versión aplica desde su fecha de vigencia. No se permite fecha pasada, por lo que
 * ninguna venta ni liquidación histórica cambia de valor; cada operación guarda el valor y la versión aplicados.
 */
export async function crearVersionTarifa(deps: DependenciasTarifas, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquema.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la tarifa", campos);
  }
  const e = r.data;
  await autorizar(deps.auditor, ctx, "tarifa:modificar", { accion: "tarifa.modificar", entidad: "tarifa", fincaId: undefined });
  try {
    return await deps.uow.ejecutar(async (tx) => {
      if (!(await deps.repo.bloquearTarifa(tx, ctx.organizacionId, e.tarifaId))) throw new ErrorNoEncontrado("Tarifa");
      if (e.desde < fechaColombia()) throw new ErrorRegla("La vigencia no puede empezar en el pasado: no se reescribe el historial", "vigencia_pasada");
      const ultima = await deps.repo.ultimaVersion(tx, e.tarifaId);
      if (ultima) {
        if (ultima.hasta === null) {
          if (e.desde <= ultima.desde) throw new ErrorRegla("La nueva vigencia debe empezar después de la versión anterior", "vigencia_solapada");
          await deps.repo.cerrarVigencia(tx, ultima.id, e.desde);
        } else if (e.desde < ultima.hasta) {
          throw new ErrorRegla("La nueva vigencia se solapa con la versión anterior", "vigencia_solapada");
        }
      }
      const version = (ultima?.version ?? 0) + 1;
      const id = await deps.repo.insertarVersion(tx, { tarifaId: e.tarifaId, version, valor: e.valor, desde: e.desde, creadaPor: ctx.usuarioId });
      await deps.auditor.registrar(
        {
          organizacionId: ctx.organizacionId,
          usuarioId: ctx.usuarioId,
          accion: "tarifa.modificar",
          entidad: "tarifa",
          entidadId: e.tarifaId,
          resultado: "ok",
          antes: ultima ? { version: ultima.version } : null,
          despues: { version, valor: e.valor, desde: e.desde },
          ip: ctx.ip,
        },
        tx,
      );
      return { versionId: id, version };
    });
  } catch (error) {
    if (error instanceof ErrorNegocio) {
      await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "tarifa.modificar", entidad: "tarifa", resultado: "error", despues: { codigo: error.codigo }, ip: ctx.ip });
    }
    throw error;
  }
}

export async function listarTarifas(deps: DependenciasTarifas, ctx: ContextoUsuario): Promise<FilaTarifa[]> {
  await autorizar(deps.auditor, ctx, "tarifa:ver", { accion: "tarifa.listar", entidad: "tarifa" });
  return deps.uow.consultar((tx) => deps.repo.listar(tx, ctx.organizacionId, fechaColombia()));
}

export async function historialTarifa(deps: DependenciasTarifas, ctx: ContextoUsuario, tarifaId: string) {
  await autorizar(deps.auditor, ctx, "tarifa:ver", { accion: "tarifa.historial", entidad: "tarifa" });
  return deps.uow.consultar((tx) => deps.repo.historial(tx, ctx.organizacionId, tarifaId));
}

const TIPOS = ["precio_venta", "precio_compra", "pago_kg", "pago_arroba", "pago_jornada", "pago_actividad", "especial"] as const;
const UNIDAD_POR_TIPO: Record<string, string[]> = {
  precio_venta: ["kg"], precio_compra: ["kg", "saco", "arroba", "carga"], pago_kg: ["kg"], pago_arroba: ["arroba"],
  pago_jornada: ["jornada"], pago_actividad: ["actividad"], especial: ["kg", "arroba", "jornada", "actividad"],
};
const esquemaNueva = z.object({
  codigo: z.string().trim().min(3, "Indique un código").max(60),
  tipo: z.enum(TIPOS, { message: "Tipo de tarifa inválido" }),
  unidadCodigo: z.string().trim().min(1),
  fincaId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
  trabajadorId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
  productoId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
  valor: z.string().regex(/^\d{1,11}(\.\d{1,2})?$/, "Valor inválido (máximo 2 decimales)"),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

/**
 * Crea una tarifa con su primera versión. Las tarifas de pago pueden ser generales, de una finca o de un trabajador.
 * La primera versión puede tener vigencia pasada porque aún no existe historial que reescribir.
 */
export async function crearTarifa(deps: DependenciasTarifas, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquemaNueva.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la tarifa", campos);
  }
  const e = r.data;
  await autorizar(deps.auditor, ctx, "tarifa:modificar", { accion: "tarifa.crear", entidad: "tarifa", fincaId: e.fincaId });
  if (!UNIDAD_POR_TIPO[e.tipo].includes(e.unidadCodigo)) {
    throw new ErrorRegla(`La unidad ${e.unidadCodigo} no corresponde al tipo de tarifa ${e.tipo}`, "unidad_no_corresponde");
  }
  return deps.uow.ejecutar(async (tx) => {
    const tarifaId = await deps.repo.insertarTarifa(tx, { organizacionId: ctx.organizacionId, ...e });
    const versionId = await deps.repo.insertarVersion(tx, { tarifaId, version: 1, valor: e.valor, desde: e.desde, creadaPor: ctx.usuarioId });
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "tarifa.crear", entidad: "tarifa", entidadId: tarifaId, resultado: "ok", despues: { codigo: e.codigo, tipo: e.tipo, valor: e.valor, desde: e.desde }, ip: ctx.ip },
      tx,
    );
    return { tarifaId, versionId };
  });
}
