import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { FilaCartera, RepositorioPagosClientes, VentaParaPago } from "../domain/pagos";

export class RepositorioPagosPg implements RepositorioPagosClientes {
  async bloquearVenta(tx: Transaccion, organizacionId: string, ventaId: string): Promise<VentaParaPago | null> {
    const c = clienteDe(tx);
    // Primero se bloquea la fila; la suma de pagos va en una consulta aparte, con instantánea posterior al bloqueo.
    // (En READ COMMITTED una subconsulta dentro del mismo SELECT ... FOR UPDATE leería datos anteriores a la espera.)
    const r = await c.query("SELECT id, finca_id, estado, total FROM venta WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [ventaId, organizacionId]);
    const x = r.rows[0];
    if (!x) return null;
    const pagado = await c.query("SELECT coalesce(sum(monto), 0) AS pagado FROM pago_cliente WHERE venta_id = $1", [ventaId]);
    return { id: x.id, fincaId: x.finca_id, estado: x.estado, total: x.total, pagado: pagado.rows[0].pagado };
  }

  async buscarPagoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM pago_cliente WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async metodoExiste(tx: Transaccion, organizacionId: string, codigo: string, fincaIds: readonly string[]): Promise<boolean> {
    // Vale si es de la base del sistema o propio de alguna finca de la persona.
    const r = await clienteDe(tx).query("SELECT 1 FROM catalogo_valor WHERE organizacion_id = $1 AND catalogo = 'metodo_pago' AND codigo = $2 AND activo AND (finca_id IS NULL OR finca_id = ANY($3::uuid[]))", [organizacionId, codigo, fincaIds]);
    return (r.rowCount ?? 0) > 0;
  }

  async insertarPago(tx: Transaccion, p: { organizacionId: string; ventaId: string; monto: string; metodo: string; fecha: string; clave: string; registradoPor: string }): Promise<string> {
    const r = await clienteDe(tx).query(
      "INSERT INTO pago_cliente (organizacion_id, venta_id, monto, metodo, fecha, clave_idempotencia, registrado_por) VALUES ($1,$2,$3,$4,(($5::date + time '12:00') AT TIME ZONE 'America/Bogota'),$6,$7) RETURNING id",
      [p.organizacionId, p.ventaId, p.monto, p.metodo, p.fecha, p.clave, p.registradoPor],
    );
    return r.rows[0].id as string;
  }

  async listarCartera(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloPendiente: boolean): Promise<FilaCartera[]> {
    const r = await clienteDe(tx).query(
      `SELECT v.id, v.numero_comprobante, v.fecha::text AS fecha, c.nombre AS cliente, f.nombre AS finca, v.total,
              coalesce(pg.pagado, 0) AS pagado, (v.total - coalesce(pg.pagado, 0)) AS saldo,
              (current_date - v.fecha::date) AS dias
         FROM venta v JOIN cliente c ON c.id = v.cliente_id JOIN finca f ON f.id = v.finca_id
         LEFT JOIN LATERAL (SELECT sum(monto) AS pagado FROM pago_cliente p WHERE p.venta_id = v.id) pg ON true
        WHERE v.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[]) AND v.estado = 'confirmada'
          AND (NOT $3::boolean OR v.total > coalesce(pg.pagado, 0))
        ORDER BY v.fecha DESC LIMIT 200`,
      [organizacionId, fincaIds, soloPendiente],
    );
    return r.rows.map((x) => ({ ventaId: x.id, comprobante: String(x.numero_comprobante), fecha: x.fecha, cliente: x.cliente, fincaNombre: x.finca, total: x.total, pagado: x.pagado, saldo: x.saldo, diasAntiguedad: x.dias }));
  }
}
