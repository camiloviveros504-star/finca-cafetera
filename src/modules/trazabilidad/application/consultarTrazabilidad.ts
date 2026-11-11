import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado } from "@/shared/dominio/errores";
import type { RepositorioTrazabilidad, Trazabilidad } from "../domain/puertos";

export interface DependenciasTrazabilidad {
  repo: RepositorioTrazabilidad;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export async function consultarTrazabilidadVenta(
  deps: DependenciasTrazabilidad,
  ctx: ContextoUsuario,
  ventaId: string,
): Promise<Trazabilidad> {
  await autorizar(deps.auditor, ctx, "trazabilidad:ver", {
    accion: "trazabilidad.consultar",
    entidad: "venta",
  });
  const resultado = await deps.uow.consultar((tx) => deps.repo.porVenta(tx, ctx.organizacionId, ctx.fincaIds, ventaId));
  if (!resultado) throw new ErrorNoEncontrado("Venta");
  return resultado;
}
