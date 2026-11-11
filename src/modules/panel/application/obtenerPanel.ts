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
    const { organizacionId: o, fincaIds: f } = ctx;
    if (ctx.permisos.has("inventario:ver")) r.existencias = await deps.repo.existencias(tx, o, f);
    if (ctx.permisos.has("venta:ver")) r.ventasMes = await deps.repo.ventasMes(tx, o, f);
    if (ctx.permisos.has("cosecha:ver")) {
      r.cosechasMes = await deps.repo.cosechasMes(tx, o, f);
      r.recoleccionPorLote = await deps.repo.recoleccionPorLote(tx, o, f);
      r.recoleccionPorMes = await deps.repo.recoleccionPorMes(tx, o, f);
    }
    // La billetera mezcla cobros, gastos y pagos: solo quien ve las finanzas de la finca.
    if (ctx.permisos.has("finanzas:ver")) {
      r.billeteraMes = await deps.repo.billeteraMes(tx, o, f);
      r.porPagar = await deps.repo.porPagar(tx, o, f);
    }
    if (ctx.permisos.has("pago:ver")) r.porCobrar = await deps.repo.porCobrar(tx, o, f);
    if (ctx.permisos.has("inspeccion:ver")) r.plagasActivas = await deps.repo.plagasActivas(tx, o, f);
    if (ctx.permisos.has("agroquimico:ver")) r.insumosPorVencer = await deps.repo.insumosPorVencer(tx, o, f);
    // Totales de la plataforma: solo quien administra fincas y cuentas.
    if (ctx.permisos.has("finca:administrar") && ctx.permisos.has("usuario:administrar")) r.plataforma = await deps.repo.plataforma(tx, o);
    return r;
  });
}

export type { Billetera, ResumenPanel } from "../domain/puertos";
