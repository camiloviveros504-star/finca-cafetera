/**
 * Ciclo del lote y plan de manejo por edad. Un lote puede estar sin sembrar, en levante, en producción o pedir renovación;
 * se registra cuándo se sembró (y cuántos árboles), cuándo se hizo zoca, cuándo se tumbó y se resembró, y todo queda en su
 * historial. La edad sale de la fecha de siembra (o de la última zoca) y con ella se muestra el plan de abonada y la
 * sugerencia de renovar, con la fuente de cada recomendación. La densidad sugerida es un parámetro (por defecto 5.000
 * árboles por hectárea, valor de referencia de Cenicafé) que la finca puede cambiar.
 */
import { z } from "zod";
import type { RepositorioConfiguracion } from "@/modules/configuracion/application/consultas";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado, ErrorProhibido, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import type { EtapaCultivo, FilaLoteCultivo, Recomendacion, RepositorioCultivo } from "../domain/cultivo";

export const DENSIDAD_POR_DEFECTO = 5000; // árboles por hectárea (Cenicafé: unas 5.000 plantas/ha; hasta 10.000 en variedades de porte bajo)
const EDAD_PRODUCCION_MESES = 24;
const EDAD_RENOVACION_MESES = 60;

export interface DependenciasCultivo {
  repo: RepositorioCultivo;
  configuracion: RepositorioConfiguracion;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export interface ItemPlan {
  titulo: string; detalle: string; labor: string; desdeMeses: number; estado: "pasada" | "proxima" | "futura" | "vigente";
  gramosPorPlanta: string | null; kgTotales: string | null; fuente: string;
}

export interface LoteConPlan extends FilaLoteCultivo {
  etapa: EtapaCultivo;
  arbolesSugeridos: number | null;
  densidadReferencia: number;
  plan: ItemPlan[];
}

export function etapaDeEdad(estado: string, edadMeses: number | null): EtapaCultivo {
  if (estado === "sin_sembrar" || edadMeses === null) return "sin_sembrar";
  if (edadMeses < EDAD_PRODUCCION_MESES) return "levante";
  if (edadMeses < EDAD_RENOVACION_MESES) return "produccion";
  return "renovacion";
}

function construirPlan(etapa: EtapaCultivo, edad: number, arboles: number | null, recs: Recomendacion[]): ItemPlan[] {
  if (etapa === "sin_sembrar") return [];
  const items = recs.filter((r) => r.etapa === etapa);
  let proxima = false;
  return items.map((r): ItemPlan => {
    let estado: ItemPlan["estado"] = "vigente";
    if (etapa === "levante") {
      if (r.desdeMeses < edad - 1) estado = "pasada";
      else if (!proxima) { estado = "proxima"; proxima = true; }
      else estado = "futura";
    }
    const g = r.gramosPorPlanta !== null ? Number(r.gramosPorPlanta) : null;
    return { titulo: r.titulo, detalle: r.detalle, labor: r.labor, desdeMeses: r.desdeMeses, estado, gramosPorPlanta: r.gramosPorPlanta, kgTotales: g !== null && arboles ? ((g * arboles) / 1000).toFixed(1) : null, fuente: r.fuente };
  });
}

export async function consultarCultivo(deps: DependenciasCultivo, ctx: ContextoUsuario): Promise<LoteConPlan[]> {
  await autorizar(deps.auditor, ctx, "lote:ver", { accion: "lote.cultivo", entidad: "lote" });
  return deps.uow.consultar(async (tx) => {
    const lotes = await deps.repo.listarLotes(tx, ctx.organizacionId, ctx.fincaIds);
    const recs = await deps.repo.listarRecomendaciones(tx, ctx.organizacionId);
    const densidades = new Map<string, number>();
    for (const f of new Set(lotes.map((l) => l.fincaId))) {
      const v = await deps.configuracion.parametro(tx, ctx.organizacionId, f, "arboles_por_hectarea");
      densidades.set(f, v !== null && Number(v) > 0 ? Number(v) : DENSIDAD_POR_DEFECTO);
    }
    return lotes.map((l) => {
      const etapa = etapaDeEdad(l.estado, l.edadMeses);
      const densidad = densidades.get(l.fincaId) ?? DENSIDAD_POR_DEFECTO;
      return { ...l, etapa, densidadReferencia: densidad, arbolesSugeridos: l.areaHa ? Math.round(Number(l.areaHa) * densidad) : null, plan: construirPlan(etapa, l.edadMeses ?? 0, l.numeroArboles, recs) };
    });
  });
}

const esquemaEvento = z.object({
  loteId: z.string().uuid(),
  tipo: z.enum(["siembra", "zoca", "tumba", "resiembra", "observacion"], { message: "Tipo de evento inválido" }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  arboles: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(1).max(200000).optional()),
  detalle: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(300).optional()),
});

/** Siembra, zoca, tumba y resiembra cambian el estado del lote; todas quedan en su historial con fecha y responsable. */
export async function registrarEventoLote(deps: DependenciasCultivo, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquemaEvento.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos del evento", campos);
  }
  const e = r.data;
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha no puede ser futura", { fecha: "Fecha futura" });
  await autorizar(deps.auditor, ctx, "lote:administrar", { accion: "lote.evento", entidad: "lote" });
  return deps.uow.ejecutar(async (tx) => {
    const lote = await deps.repo.obtenerLote(tx, ctx.organizacionId, e.loteId);
    if (!lote) throw new ErrorNoEncontrado("Lote");
    if (!ctx.fincaIds.includes(lote.fincaId)) throw new ErrorProhibido();
    const sembrado = lote.estado !== "sin_sembrar";
    if ((e.tipo === "siembra" || e.tipo === "resiembra")) {
      if (sembrado) throw new ErrorRegla("El lote ya está sembrado; para sembrar de nuevo primero registre la tumba", "lote_ya_sembrado");
      if (!e.arboles) throw new ErrorValidacion("Indique cuántos árboles se sembraron", { arboles: "Obligatorio" });
    }
    if ((e.tipo === "zoca" || e.tipo === "tumba") && !sembrado) throw new ErrorRegla("El lote no está sembrado", "lote_sin_sembrar");
    await deps.repo.aplicarEvento(tx, { organizacionId: ctx.organizacionId, loteId: e.loteId, tipo: e.tipo, fecha: e.fecha, arboles: e.arboles, detalle: e.detalle, creadoPor: ctx.usuarioId });
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "lote.evento", entidad: "lote", entidadId: e.loteId, resultado: "ok", despues: { tipo: e.tipo, fecha: e.fecha, arboles: e.arboles ?? null }, ip: ctx.ip }, tx);
    return { ok: true };
  });
}

/** Un lote sin historial (sin cosechas, movimientos, gastos ni aplicaciones) se puede eliminar; con historial no, para no perder la trazabilidad. */
export async function eliminarLote(deps: DependenciasCultivo, ctx: ContextoUsuario, loteId: string) {
  if (!z.string().uuid().safeParse(loteId).success) throw new ErrorNoEncontrado("Lote");
  await autorizar(deps.auditor, ctx, "lote:administrar", { accion: "lote.eliminar", entidad: "lote" });
  return deps.uow.ejecutar(async (tx) => {
    const lote = await deps.repo.obtenerLote(tx, ctx.organizacionId, loteId);
    if (!lote || !ctx.fincaIds.includes(lote.fincaId)) throw new ErrorNoEncontrado("Lote");
    if ((await deps.repo.eliminarLote(tx, ctx.organizacionId, loteId)) === "con_historial") {
      throw new ErrorRegla("El lote tiene historial (cosechas, movimientos, gastos o aplicaciones) y no se puede eliminar; así se conserva la trazabilidad. Puede dejarlo sin sembrar o inactivo.", "lote_con_historial");
    }
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "lote.eliminar", entidad: "lote", entidadId: loteId, resultado: "ok", ip: ctx.ip }, tx);
    return { ok: true };
  });
}

export type { EtapaCultivo, FilaLoteCultivo, Recomendacion } from "../domain/cultivo";
