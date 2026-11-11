import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { RepositorioTrazabilidad, Trazabilidad, TrazaLinea } from "../domain/puertos";

export class RepositorioTrazabilidadPg implements RepositorioTrazabilidad {
  async porVenta(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
    ventaId: string,
  ): Promise<Trazabilidad | null> {
    const c = clienteDe(tx);
    const v = await c.query(
      `SELECT v.id, v.numero_comprobante, v.fecha, cl.nombre AS cliente
         FROM venta v JOIN cliente cl ON cl.id = v.cliente_id
        WHERE v.id = $1 AND v.organizacion_id = $2 AND v.finca_id = ANY($3::uuid[])`,
      [ventaId, organizacionId, fincaIds],
    );
    if (!v.rows[0]) return null;
    const venta = v.rows[0];

    const detalles = await c.query(
      `SELECT d.producto_id, p.nombre AS producto, d.lote_id, l.codigo, l.nombre AS lote_nombre, f.nombre AS finca,
              d.cantidad, d.movimiento_id
         FROM venta_detalle d JOIN producto p ON p.id = d.producto_id JOIN lote l ON l.id = d.lote_id
         JOIN finca f ON f.id = d.finca_id
        WHERE d.venta_id = $1 ORDER BY l.codigo, d.id`,
      [ventaId],
    );

    const lineas: TrazaLinea[] = [];
    for (const d of detalles.rows) {
      const [transformaciones, cosechas] = await Promise.all([
        c.query(
          `SELECT t.id, t.tipo, t.fecha::text AS fecha, pe.nombre AS entrada, ps.nombre AS salida,
                  tl.cantidad_entrada, tl.cantidad_salida
             FROM transformacion_linea tl
             JOIN transformacion t ON t.id = tl.transformacion_id
             JOIN producto pe ON pe.id = tl.producto_entrada_id
             JOIN producto ps ON ps.id = tl.producto_salida_id
            WHERE tl.lote_id = $1 AND tl.producto_salida_id = $2 AND t.fecha <= $3::timestamptz::date
            ORDER BY t.fecha`,
          [d.lote_id, d.producto_id, venta.fecha],
        ),
        c.query(
          `SELECT c.id, c.fecha::text AS fecha, c.cantidad, u.codigo AS unidad
             FROM cosecha c JOIN unidad u ON u.id = c.unidad_id
            WHERE c.lote_id = $1 AND c.estado = 'confirmada' AND c.fecha <= $2::timestamptz::date
            ORDER BY c.fecha`,
          [d.lote_id, venta.fecha],
        ),
      ]);
      lineas.push({
        producto: d.producto,
        loteId: d.lote_id,
        loteCodigo: d.codigo,
        loteNombre: d.lote_nombre,
        fincaNombre: d.finca,
        cantidadVendida: d.cantidad,
        movimientoId: d.movimiento_id,
        transformaciones: transformaciones.rows.map((t) => ({
          transformacionId: t.id,
          tipo: t.tipo,
          fecha: t.fecha,
          productoEntrada: t.entrada,
          productoSalida: t.salida,
          cantidadEntrada: t.cantidad_entrada,
          cantidadSalida: t.cantidad_salida,
        })),
        cosechas: cosechas.rows.map((h) => ({ cosechaId: h.id, fecha: h.fecha, cantidad: h.cantidad, unidad: h.unidad })),
      });
    }
    return {
      ventaId: venta.id,
      numeroComprobante: String(venta.numero_comprobante),
      fecha: (venta.fecha as Date).toISOString(),
      cliente: venta.cliente,
      lineas,
    };
  }
}
