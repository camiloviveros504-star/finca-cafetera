import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorClaveDuplicada } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { FilaVenta, NuevoDetalle, RepositorioVentas, VentaRegistrada } from "../domain/puertos";

const SQL_VENTA = `SELECT v.id, v.numero_comprobante, v.finca_id, v.cliente_id, c.nombre AS cliente, v.fecha, v.total, v.estado
                     FROM venta v JOIN cliente c ON c.id = v.cliente_id`;

export class RepositorioVentasPg implements RepositorioVentas {
  private async completar(tx: Transaccion, fila: Record<string, unknown>): Promise<VentaRegistrada> {
    const det = await clienteDe(tx).query(
      `SELECT d.id, d.producto_id, p.nombre AS producto, d.lote_id, l.codigo AS lote, d.cantidad,
              d.precio_unitario, d.subtotal, d.tarifa_version_id
         FROM venta_detalle d JOIN producto p ON p.id = d.producto_id JOIN lote l ON l.id = d.lote_id
        WHERE d.venta_id = $1 ORDER BY l.codigo, d.id`,
      [fila.id],
    );
    return {
      id: fila.id as string,
      numeroComprobante: String(fila.numero_comprobante),
      fincaId: fila.finca_id as string,
      clienteId: fila.cliente_id as string,
      clienteNombre: fila.cliente as string,
      fecha: (fila.fecha as Date).toISOString(),
      total: fila.total as string,
      estado: fila.estado as string,
      detalles: det.rows.map((d) => ({
        id: d.id,
        productoId: d.producto_id,
        productoNombre: d.producto,
        loteId: d.lote_id,
        loteCodigo: d.lote,
        cantidad: d.cantidad,
        precioUnitario: d.precio_unitario,
        subtotal: d.subtotal,
        tarifaVersionId: d.tarifa_version_id,
      })),
    };
  }

  async buscarPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<VentaRegistrada | null> {
    const r = await clienteDe(tx).query(`${SQL_VENTA} WHERE v.organizacion_id = $1 AND v.clave_idempotencia = $2`, [
      organizacionId,
      clave,
    ]);
    return r.rows[0] ? this.completar(tx, r.rows[0]) : null;
  }

  async clienteExiste(tx: Transaccion, organizacionId: string, clienteId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM cliente WHERE id = $1 AND organizacion_id = $2 AND activo", [
      clienteId,
      organizacionId,
    ]);
    return r.rowCount === 1;
  }

  async insertarEncabezado(
    tx: Transaccion,
    v: { id: string; organizacionId: string; fincaId: string; clienteId: string; clave: string; creadoPor: string; nota?: string },
  ): Promise<void> {
    try {
      await clienteDe(tx).query(
        `INSERT INTO venta (id, organizacion_id, finca_id, cliente_id, total, clave_idempotencia, creado_por, nota)
         VALUES ($1,$2,$3,$4,0,$5,$6,$7)`,
        [v.id, v.organizacionId, v.fincaId, v.clienteId, v.clave, v.creadoPor, v.nota ?? null],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorClaveDuplicada();
      throw error;
    }
  }

  async insertarDetalle(tx: Transaccion, d: NuevoDetalle): Promise<void> {
    await clienteDe(tx).query(
      `INSERT INTO venta_detalle (venta_id, producto_id, lote_id, finca_id, bodega_id, cantidad, precio_unitario, tarifa_version_id, subtotal, movimiento_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [d.ventaId, d.productoId, d.loteId, d.fincaId, d.bodegaId, d.cantidad, d.precioUnitario, d.tarifaVersionId, d.subtotal, d.movimientoId],
    );
  }

  async fijarTotal(tx: Transaccion, ventaId: string, total: string): Promise<void> {
    await clienteDe(tx).query("UPDATE venta SET total = $2 WHERE id = $1", [ventaId, total]);
  }

  async obtener(tx: Transaccion, organizacionId: string, ventaId: string): Promise<VentaRegistrada | null> {
    const r = await clienteDe(tx).query(`${SQL_VENTA} WHERE v.organizacion_id = $1 AND v.id = $2`, [organizacionId, ventaId]);
    return r.rows[0] ? this.completar(tx, r.rows[0]) : null;
  }

  async listar(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
    limite: number,
    desplazamiento: number,
  ): Promise<{ filas: FilaVenta[]; total: number }> {
    const cliente = clienteDe(tx);
    const [filas, total] = await Promise.all([
      cliente.query(
        `SELECT v.id, v.numero_comprobante, v.fecha, f.nombre AS finca, c.nombre AS cliente, v.total, v.estado
           FROM venta v JOIN finca f ON f.id = v.finca_id JOIN cliente c ON c.id = v.cliente_id
          WHERE v.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[])
          ORDER BY v.fecha DESC LIMIT $3 OFFSET $4`,
        [organizacionId, fincaIds, limite, desplazamiento],
      ),
      cliente.query("SELECT count(*)::int AS n FROM venta WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[])", [
        organizacionId,
        fincaIds,
      ]),
    ]);
    return {
      filas: filas.rows.map((x) => ({
        id: x.id,
        numeroComprobante: String(x.numero_comprobante),
        fecha: (x.fecha as Date).toISOString(),
        fincaNombre: x.finca,
        clienteNombre: x.cliente,
        total: x.total,
        estado: x.estado,
      })),
      total: total.rows[0].n,
    };
  }
}
