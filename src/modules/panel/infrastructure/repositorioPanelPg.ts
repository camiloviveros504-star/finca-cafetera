import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { RepositorioPanel } from "../domain/puertos";

export class RepositorioPanelPg implements RepositorioPanel {
  async existencias(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT p.nombre AS producto, sum(s.cantidad) AS kg
         FROM saldo_inventario s JOIN producto p ON p.id = s.producto_id
        WHERE s.organizacion_id = $1 AND s.finca_id = ANY($2::uuid[]) AND s.cantidad > 0
        GROUP BY p.nombre ORDER BY p.nombre`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({ producto: x.producto as string, kg: x.kg as string }));
  }

  async ventas30d(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT count(*)::int AS n, coalesce(sum(total), 0) AS total FROM venta
        WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) AND estado = 'confirmada' AND fecha >= now() - interval '30 days'`,
      [organizacionId, fincaIds],
    );
    return { cantidad: r.rows[0].n as number, total: r.rows[0].total as string };
  }

  async cosechas30d(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT count(*)::int AS n, coalesce(sum(cantidad_base), 0) AS kg FROM cosecha
        WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) AND estado = 'confirmada' AND fecha >= current_date - 30`,
      [organizacionId, fincaIds],
    );
    return { cantidad: r.rows[0].n as number, kg: r.rows[0].kg as string };
  }
}
