/**
 * Eliminación protegida de registros de la finca (compradores, proveedores, insumos, trabajadores, equipos y actividades).
 * Un registro sin historial se borra de verdad. Si ya participa en ventas, compras, pagos, aplicaciones o liquidaciones no se puede
 * borrar sin romper la contabilidad y la trazabilidad: se archiva, es decir, deja de aparecer en listas y formularios pero su
 * historial se conserva. Siempre con permiso, alcance de finca y auditoría.
 */
import { z } from "zod";
import { autorizar } from "./autorizar";
import type { Auditor, UnidadDeTrabajo } from "./puertos";
import type { Transaccion, ContextoUsuario } from "../dominio/contexto";
import { ErrorNoEncontrado, ErrorProhibido } from "../dominio/errores";

export const TIPOS_ELIMINABLES = ["cliente", "proveedor", "insumo", "trabajador", "equipo", "actividad"] as const;
export type TipoEliminable = (typeof TIPOS_ELIMINABLES)[number];

export const PERMISO_DE_ELIMINACION: Record<TipoEliminable, string> = {
  cliente: "cliente:administrar",
  proveedor: "proveedor:administrar",
  insumo: "agroquimico:administrar",
  trabajador: "trabajador:administrar",
  equipo: "equipo:administrar",
  actividad: "planificacion:administrar",
};

export interface RepositorioEliminacion {
  /** Fincas a las que pertenece el registro: `null` si no existe, lista vacía si es compartido por toda la organización. */
  fincasDe(tx: Transaccion, organizacionId: string, tipo: TipoEliminable, id: string): Promise<string[] | null>;
  eliminarOArchivar(tx: Transaccion, organizacionId: string, tipo: TipoEliminable, id: string): Promise<"eliminado" | "archivado">;
}

export interface DependenciasEliminacion {
  repo: RepositorioEliminacion;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export async function eliminarRegistro(deps: DependenciasEliminacion, ctx: ContextoUsuario, cruda: unknown) {
  const r = z.object({ tipo: z.enum(TIPOS_ELIMINABLES), id: z.string().uuid() }).safeParse(cruda);
  if (!r.success) throw new ErrorNoEncontrado("Registro");
  const { tipo, id } = r.data;
  await autorizar(deps.auditor, ctx, PERMISO_DE_ELIMINACION[tipo], { accion: `${tipo}.eliminar`, entidad: tipo });
  return deps.uow.ejecutar(async (tx) => {
    const fincas = await deps.repo.fincasDe(tx, ctx.organizacionId, tipo, id);
    if (fincas === null) throw new ErrorNoEncontrado("Registro");
    // Un registro de una finca solo lo elimina quien la tiene asignada; uno compartido, solo quien administra fincas.
    const permitido = fincas.length === 0 ? ctx.permisos.has("finca:administrar") : fincas.some((f) => ctx.fincaIds.includes(f));
    if (!permitido) {
      await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: `${tipo}.eliminar`, entidad: tipo, entidadId: id, resultado: "denegado", despues: { motivo: "finca_no_asignada" }, ip: ctx.ip });
      throw new ErrorProhibido();
    }
    const resultado = await deps.repo.eliminarOArchivar(tx, ctx.organizacionId, tipo, id);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: `${tipo}.eliminar`, entidad: tipo, entidadId: id, resultado: "ok", despues: { resultado }, ip: ctx.ip }, tx);
    return { resultado };
  });
}
