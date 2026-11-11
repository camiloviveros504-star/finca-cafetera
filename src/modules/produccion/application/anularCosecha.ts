/**
 * Anulación de una cosecha (corrección auditada): compensa la entrada de inventario con un reverso. Si parte de lo
 * cosechado ya se transformó o se vendió, el reverso dejaría existencias negativas y se rechaza (D1): primero hay que
 * resolver esas operaciones. Nada se borra; la cosecha queda 'anulada' con responsable y motivo.
 */
import { z } from "zod";
import { reversarEnTransaccion, type DependenciasOperaciones } from "@/modules/inventario/application/operaciones";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioAnulacionCosecha } from "../domain/anulacion";

export interface DependenciasAnulacionCosecha {
  repo: RepositorioAnulacionCosecha;
  operaciones: DependenciasOperaciones;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const esquema = z.object({ cosechaId: z.string().uuid(), motivo: z.string().trim().min(10, "Explique el motivo (mínimo 10 caracteres)").max(300) });

export async function anularCosecha(deps: DependenciasAnulacionCosecha, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquema.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la anulación", campos);
  }
  const e = r.data;
  await autorizar(deps.auditor, ctx, "cosecha:anular", { accion: "cosecha.anular", entidad: "cosecha" });
  return deps.uow.ejecutar(async (tx) => {
    const c = await deps.repo.bloquearCosecha(tx, ctx.organizacionId, e.cosechaId);
    if (!c || !ctx.fincaIds.includes(c.fincaId)) throw new ErrorNoEncontrado("Cosecha");
    if (c.estado !== "confirmada") throw new ErrorRegla("La cosecha ya está anulada", "cosecha_ya_anulada");
    if (!c.movimientoId) throw new ErrorRegla("La cosecha no tiene movimiento de inventario asociado", "sin_movimiento");
    try {
      await reversarEnTransaccion(deps.operaciones, tx, ctx, c.movimientoId, `Anulación de cosecha: ${e.motivo}`, ["cosecha"]);
    } catch (error) {
      if (error instanceof ErrorRegla && error.codigo === "reverso_deja_negativo") {
        throw new ErrorRegla("No se puede anular: parte de lo cosechado ya fue transformado, trasladado o vendido", "cosecha_ya_utilizada");
      }
      throw error;
    }
    await deps.repo.marcarAnulada(tx, c.id, ctx.usuarioId, e.motivo);
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "cosecha.anular", entidad: "cosecha", entidadId: c.id, resultado: "ok", despues: { motivo: e.motivo }, ip: ctx.ip },
      tx,
    );
    return { cosechaId: c.id };
  });
}
