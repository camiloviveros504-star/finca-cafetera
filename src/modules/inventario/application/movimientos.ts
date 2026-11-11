import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { ContextoUsuario, Transaccion } from "@/shared/dominio/contexto";
import { aEscala, deEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { ErrorExistenciasInsuficientes, ErrorValidacion } from "@/shared/dominio/errores";
import { asignarExistencias } from "../domain/asignacion";
import type { FilaSaldo, RepositorioInventario } from "../domain/puertos";

export interface DependenciasInventario {
  repo: RepositorioInventario;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export interface ItemSalida {
  productoId: string;
  cantidad: string;
  loteId?: string;
  bodegaId?: string;
}

export interface SalidaAsignada {
  productoId: string;
  loteId: string;
  bodegaId: string;
  cantidad: string;
  movimientoId: string;
}

/**
 * ADR-002: bloquea los saldos (FOR UPDATE, orden determinista), valida, descuenta y registra los
 * movimientos. Debe llamarse DENTRO de la transacción del llamador (la venta), para que validar
 * y descontar sean una sola operación atómica. La autorización la hace el caso de uso llamador.
 */
export async function descontarParaVenta(
  deps: Pick<DependenciasInventario, "repo">,
  tx: Transaccion,
  ctx: ContextoUsuario,
  entrada: { ventaId: string; fincaId: string; items: readonly ItemSalida[] },
): Promise<SalidaAsignada[]> {
  // Se agrupan los ítems iguales y se procesan ordenados para que dos ventas nunca se bloqueen entre sí.
  const agrupados = new Map<string, ItemSalida & { total: bigint }>();
  for (const item of entrada.items) {
    const cantidad = aEscala(item.cantidad, ESCALA_CANTIDAD);
    if (cantidad <= 0n) throw new ErrorValidacion("La cantidad debe ser mayor que cero");
    const clave = `${item.productoId}|${item.loteId ?? ""}|${item.bodegaId ?? ""}`;
    const previo = agrupados.get(clave);
    agrupados.set(clave, { ...item, total: (previo?.total ?? 0n) + cantidad });
  }
  const ordenados = [...agrupados.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const salidas: SalidaAsignada[] = [];
  for (const [, item] of ordenados) {
    const saldos = await deps.repo.bloquearSaldos(tx, {
      organizacionId: ctx.organizacionId,
      fincaId: entrada.fincaId,
      productoId: item.productoId,
      loteId: item.loteId,
      bodegaId: item.bodegaId,
      soloVendible: true,
    });
    const resultado = asignarExistencias(saldos, item.total);
    if (!resultado.alcanza) throw new ErrorExistenciasInsuficientes(deEscala(resultado.disponible, ESCALA_CANTIDAD));
    for (const a of resultado.asignaciones) {
      const cantidad = deEscala(a.cantidad, ESCALA_CANTIDAD);
      await deps.repo.descontarSaldo(tx, a.saldoId, cantidad);
      const movimientoId = await deps.repo.insertarMovimiento(tx, {
        organizacionId: ctx.organizacionId,
        fincaId: entrada.fincaId,
        bodegaId: a.bodegaId,
        productoId: item.productoId,
        loteId: a.loteId,
        tipo: "salida",
        delta: `-${cantidad}`,
        origenTipo: "venta",
        origenId: entrada.ventaId,
        creadoPor: ctx.usuarioId,
      });
      salidas.push({ productoId: item.productoId, loteId: a.loteId, bodegaId: a.bodegaId, cantidad, movimientoId });
    }
  }
  return salidas;
}

/** Entrada de inventario por una cosecha (misma transacción que la cosecha). */
export async function registrarEntradaPorCosecha(
  deps: Pick<DependenciasInventario, "repo">,
  tx: Transaccion,
  ctx: ContextoUsuario,
  entrada: {
    cosechaId: string;
    fincaId: string;
    bodegaId: string;
    productoId: string;
    loteId: string;
    cantidad: string;
  },
): Promise<string> {
  await deps.repo.acreditarSaldo(tx, {
    organizacionId: ctx.organizacionId,
    fincaId: entrada.fincaId,
    bodegaId: entrada.bodegaId,
    productoId: entrada.productoId,
    loteId: entrada.loteId,
    cantidad: entrada.cantidad,
  });
  return deps.repo.insertarMovimiento(tx, {
    organizacionId: ctx.organizacionId,
    fincaId: entrada.fincaId,
    bodegaId: entrada.bodegaId,
    productoId: entrada.productoId,
    loteId: entrada.loteId,
    tipo: "entrada",
    delta: entrada.cantidad,
    origenTipo: "cosecha",
    origenId: entrada.cosechaId,
    creadoPor: ctx.usuarioId,
  });
}

export async function consultarSaldos(
  deps: DependenciasInventario,
  ctx: ContextoUsuario,
  fincaId?: string,
): Promise<FilaSaldo[]> {
  await autorizar(deps.auditor, ctx, "inventario:ver", {
    accion: "inventario.consultar",
    entidad: "saldo_inventario",
    fincaId,
  });
  return deps.uow.consultar((tx) => deps.repo.listarSaldos(tx, ctx.organizacionId, ctx.fincaIds, fincaId));
}

export type { RepositorioInventario } from "../domain/puertos";
