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
    if (ctx.permisos.has("cosecha:ver")) {
      r.recoleccionPorLote = await deps.repo.recoleccionPorLote(tx, ctx.organizacionId, ctx.fincaIds);
      r.recoleccionPorMes = await deps.repo.recoleccionPorMes(tx, ctx.organizacionId, ctx.fincaIds);
    }
    if (ctx.permisos.has("gasto:ver")) r.gastos30d = await deps.repo.gastos30d(tx, ctx.organizacionId, ctx.fincaIds);
    if (ctx.permisos.has("pago:ver")) r.porCobrar = await deps.repo.porCobrar(tx, ctx.organizacionId, ctx.fincaIds);
    if (ctx.permisos.has("finanzas:ver")) r.porPagar = await deps.repo.porPagar(tx, ctx.organizacionId, ctx.fincaIds);
    if (ctx.permisos.has("agroquimico:ver")) r.insumosPorVencer = await deps.repo.insumosPorVencer(tx, ctx.organizacionId, ctx.fincaIds);
    // Totales de la plataforma: solo quien administra fincas y cuentas.
    if (ctx.permisos.has("finca:administrar") && ctx.permisos.has("usuario:administrar")) r.plataforma = await deps.repo.plataforma(tx, ctx.organizacionId);
    return r;
  });
}

export type { ResumenPanel } from "../domain/puertos";
