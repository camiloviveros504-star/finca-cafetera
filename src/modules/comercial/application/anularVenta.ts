/**
 * Anulación de una venta (corrección auditada): no se borra nada. Cada movimiento de salida se compensa con un reverso
 * en la misma transacción, la venta queda 'anulada' con responsable y motivo, y el inventario vuelve al lote de origen.
 * Una venta con pagos registrados no se anula: primero hay que resolver el cobro (trabajo futuro: notas de crédito).
 */
import { z } from "zod";
import { reversarEnTransaccion, type DependenciasOperaciones } from "@/modules/inventario/application/operaciones";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { mayorQue } from "@/shared/dominio/dinero";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioAnulacionVenta } from "../domain/anulacion";

export interface DependenciasAnulacionVenta {
  repo: RepositorioAnulacionVenta;
  operaciones: DependenciasOperaciones;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const esquema = z.object({ ventaId: z.string().uuid(), motivo: z.string().trim().min(10, "Explique el motivo (mínimo 10 caracteres)").max(300) });

export async function anularVenta(deps: DependenciasAnulacionVenta, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquema.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la anulación", campos);
  }
  const e = r.data;
  await autorizar(deps.auditor, ctx, "venta:anular", { accion: "venta.anular", entidad: "venta" });
  return deps.uow.ejecutar(async (tx) => {
    const v = await deps.repo.bloquearVenta(tx, ctx.organizacionId, e.ventaId);
    if (!v || !ctx.fincaIds.includes(v.fincaId)) throw new ErrorNoEncontrado("Venta");
    if (v.estado !== "confirmada") throw new ErrorRegla("La venta ya está anulada", "venta_ya_anulada");
    if (mayorQue(v.pagado, "0.00")) throw new ErrorRegla("La venta tiene pagos registrados; no puede anularse mientras existan", "venta_con_pagos");
    const movimientos = await deps.repo.movimientosDeVenta(tx, v.id);
    for (const m of movimientos) await reversarEnTransaccion(deps.operaciones, tx, ctx, m, `Anulación de venta: ${e.motivo}`, ["venta"]);
    await deps.repo.marcarAnulada(tx, v.id, ctx.usuarioId, e.motivo);
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "venta.anular", entidad: "venta", entidadId: v.id, resultado: "ok", antes: { estado: "confirmada", total: v.total }, despues: { estado: "anulada", motivo: e.motivo, movimientosRevertidos: movimientos.length }, ip: ctx.ip },
      tx,
    );
    return { ventaId: v.id, movimientosRevertidos: movimientos.length };
  });
}
