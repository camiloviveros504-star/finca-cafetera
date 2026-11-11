import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { RepositorioAnulacionVenta, VentaParaAnular } from "../domain/anulacion";

export class RepositorioAnulacionPg implements RepositorioAnulacionVenta {
  async bloquearVenta(tx: Transaccion, organizacionId: string, ventaId: string): Promise<VentaParaAnular | null> {
    const c = clienteDe(tx);
    const r = await c.query("SELECT id, finca_id, estado, total FROM venta WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [ventaId, organizacionId]);
    const x = r.rows[0];
    if (!x) return null;
    // La suma de pagos se consulta después del bloqueo (instantánea posterior a la espera).
    const p = await c.query("SELECT coalesce(sum(monto), 0) AS pagado FROM pago_cliente WHERE venta_id = $1", [ventaId]);
    return { id: x.id, fincaId: x.finca_id, estado: x.estado, total: x.total, pagado: p.rows[0].pagado };
  }

  async movimientosDeVenta(tx: Transaccion, ventaId: string): Promise<string[]> {
    const r = await clienteDe(tx).query("SELECT movimiento_id FROM venta_detalle WHERE venta_id = $1 ORDER BY lote_id, bodega_id, producto_id, id", [ventaId]);
    return r.rows.map((x) => x.movimiento_id as string);
  }

  async marcarAnulada(tx: Transaccion, ventaId: string, usuarioId: string, motivo: string): Promise<void> {
    await clienteDe(tx).query("UPDATE venta SET estado = 'anulada', anulada_por = $2, anulada_en = now(), motivo_anulacion = $3 WHERE id = $1 AND estado = 'confirmada'", [ventaId, usuarioId, motivo]);
  }
}
