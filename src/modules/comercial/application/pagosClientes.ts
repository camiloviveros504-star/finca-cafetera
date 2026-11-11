/**
 * Pagos de clientes y cartera (cuentas por cobrar). El pago nunca supera el saldo, es idempotente y queda como hecho
 * inmutable. Los comprobantes son internos: este sistema no emite facturas electrónicas DIAN.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { mayorQue, restar } from "@/shared/dominio/dinero";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioPagosClientes } from "../domain/pagos";

export interface DependenciasPagos {
  repo: RepositorioPagosClientes;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const esquema = z.object({
  ventaId: z.string().uuid(),
  monto: z.string().regex(/^\d{1,11}(\.\d{1,2})?$/, "Monto inválido (máximo 2 decimales)"),
  metodo: z.string().trim().min(2, "Indique el método de pago"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  claveIdempotencia: z.string().min(8).max(100),
});

export async function registrarPagoCliente(deps: DependenciasPagos, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquema.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos del pago", campos);
  }
  const e = r.data;
  if (Number(e.monto) <= 0) throw new ErrorValidacion("El monto debe ser mayor que cero", { monto: "Monto inválido" });
  await autorizar(deps.auditor, ctx, "pago:registrar", { accion: "pago_cliente.registrar", entidad: "pago_cliente" });
  return deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.buscarPagoPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previo) return { id: previo, repetido: true };
    if (!(await deps.repo.metodoExiste(tx, ctx.organizacionId, e.metodo))) throw new ErrorRegla("Método de pago no configurado", "metodo_pago_invalido");
    const venta = await deps.repo.bloquearVenta(tx, ctx.organizacionId, e.ventaId);
    if (!venta || !ctx.fincaIds.includes(venta.fincaId)) throw new ErrorNoEncontrado("Venta");
    if (venta.estado !== "confirmada") throw new ErrorRegla("No se registran pagos sobre una venta anulada", "venta_anulada");
    const saldo = restar(venta.total, venta.pagado);
    if (mayorQue(e.monto, saldo)) throw new ErrorRegla(`El pago supera el saldo pendiente (${saldo})`, "pago_excede_saldo");
    const id = await deps.repo.insertarPago(tx, { organizacionId: ctx.organizacionId, ventaId: e.ventaId, monto: e.monto, metodo: e.metodo, fecha: e.fecha, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId });
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "pago_cliente.registrar", entidad: "pago_cliente", entidadId: id, resultado: "ok", despues: { ventaId: e.ventaId, monto: e.monto }, ip: ctx.ip }, tx);
    return { id, repetido: false };
  });
}

export async function listarCartera(deps: DependenciasPagos, ctx: ContextoUsuario, soloPendiente = true) {
  await autorizar(deps.auditor, ctx, "pago:ver", { accion: "cartera.listar", entidad: "venta" });
  return deps.uow.consultar((tx) => deps.repo.listarCartera(tx, ctx.organizacionId, ctx.fincaIds, soloPendiente));
}

export type { FilaCartera } from "../domain/pagos";
