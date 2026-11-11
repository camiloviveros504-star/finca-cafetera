/** Consulta de la auditoría (solo lectura). Solo roles con `auditoria:ver`; siempre acotada a la organización. */
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import type { ConsultaAuditoria, FiltroAuditoria } from "../domain/consulta";

export interface DependenciasAuditoria {
  consulta: ConsultaAuditoria;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export async function consultarAuditoria(deps: DependenciasAuditoria, ctx: ContextoUsuario, filtro: FiltroAuditoria, pagina: number, porPagina = 30) {
  await autorizar(deps.auditor, ctx, "auditoria:ver", { accion: "auditoria.consultar", entidad: "auditoria" });
  const limite = Math.min(Math.max(porPagina, 1), 100);
  return deps.uow.consultar((tx) => deps.consulta.listar(tx, ctx.organizacionId, filtro, limite, (Math.max(pagina, 1) - 1) * limite));
}

export type { FilaAuditoria, FiltroAuditoria } from "../domain/consulta";
