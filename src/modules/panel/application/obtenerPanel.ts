import type { UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import type { RepositorioPanel, ResumenPanel } from "../domain/puertos";

export interface DependenciasPanel {
  repo: RepositorioPanel;
  uow: UnidadDeTrabajo;
}

/** Cada indicador solo se calcula si el usuario tiene el permiso de ver ese dato. */
export async function obtenerPanel(deps: DependenciasPanel, ctx: ContextoUsuario): Promise<ResumenPanel> {
  return deps.uow.consultar(async (tx) => {
    const r: ResumenPanel = {};
    if (ctx.permisos.has("inventario:ver")) r.existencias = await deps.repo.existencias(tx, ctx.organizacionId, ctx.fincaIds);
    if (ctx.permisos.has("venta:ver")) r.ventas30d = await deps.repo.ventas30d(tx, ctx.organizacionId, ctx.fincaIds);
    if (ctx.permisos.has("cosecha:ver")) r.cosechas30d = await deps.repo.cosechas30d(tx, ctx.organizacionId, ctx.fincaIds);
    return r;
  });
}

export type { ResumenPanel } from "../domain/puertos";
