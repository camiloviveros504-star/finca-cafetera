import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { CosechaParaAnular, RepositorioAnulacionCosecha } from "../domain/anulacion";

export class RepositorioAnulacionCosechaPg implements RepositorioAnulacionCosecha {
  async bloquearCosecha(tx: Transaccion, organizacionId: string, cosechaId: string): Promise<CosechaParaAnular | null> {
    const c = clienteDe(tx);
    const r = await c.query("SELECT id, finca_id, estado FROM cosecha WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [cosechaId, organizacionId]);
    const x = r.rows[0];
    if (!x) return null;
    const m = await c.query("SELECT id FROM movimiento_inventario WHERE origen_tipo = 'cosecha' AND origen_id = $1 AND tipo = 'entrada'", [cosechaId]);
    return { id: x.id, fincaId: x.finca_id, estado: x.estado, movimientoId: m.rows[0]?.id ?? null };
  }

  async marcarAnulada(tx: Transaccion, cosechaId: string, usuarioId: string, motivo: string): Promise<void> {
    await clienteDe(tx).query("UPDATE cosecha SET estado = 'anulada', anulada_por = $2, anulada_en = now(), motivo_anulacion = $3 WHERE id = $1 AND estado = 'confirmada'", [cosechaId, usuarioId, motivo]);
  }
}
