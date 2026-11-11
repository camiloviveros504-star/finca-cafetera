import type { Transaccion } from "@/shared/dominio/contexto";
import { aEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { SaldoCandidato } from "../domain/asignacion";
import type { FilaSaldo, FiltroSaldos, NuevoMovimiento, RepositorioInventario } from "../domain/puertos";

export class RepositorioInventarioPg implements RepositorioInventario {
  async bloquearSaldos(tx: Transaccion, f: FiltroSaldos): Promise<SaldoCandidato[]> {
    const params: unknown[] = [f.organizacionId, f.fincaId, f.productoId];
    let extra = "";
    if (f.loteId) {
      params.push(f.loteId);
      extra += ` AND s.lote_id = $${params.length}`;
    }
    if (f.bodegaId) {
      params.push(f.bodegaId);
      extra += ` AND s.bodega_id = $${params.length}`;
    }
    if (f.soloVendible) extra += " AND p.vendible";
    // Orden determinista (código de lote, id) = orden de bloqueo = orden de asignación.
    const r = await clienteDe(tx).query(
      `SELECT s.id, s.lote_id, s.bodega_id, s.cantidad
         FROM saldo_inventario s
         JOIN lote l ON l.id = s.lote_id
         JOIN producto p ON p.id = s.producto_id
        WHERE s.organizacion_id = $1 AND s.finca_id = $2 AND s.producto_id = $3 AND s.cantidad > 0${extra}
        ORDER BY l.codigo, s.id
        FOR UPDATE OF s`,
      params,
    );
    return r.rows.map((x) => ({
      id: x.id as string,
      loteId: x.lote_id as string,
      bodegaId: x.bodega_id as string,
      cantidad: aEscala(x.cantidad as string, ESCALA_CANTIDAD),
    }));
  }

  async descontarSaldo(tx: Transaccion, saldoId: string, cantidad: string): Promise<void> {
    // El CHECK (cantidad >= 0) es la última defensa si este código llegara a fallar.
    await clienteDe(tx).query(
      "UPDATE saldo_inventario SET cantidad = cantidad - $2::numeric, actualizado_en = now() WHERE id = $1",
      [saldoId, cantidad],
    );
  }

  async acreditarSaldo(
    tx: Transaccion,
    s: { organizacionId: string; fincaId: string; bodegaId: string; productoId: string; loteId: string; cantidad: string },
  ): Promise<void> {
    await clienteDe(tx).query(
      `INSERT INTO saldo_inventario (organizacion_id, finca_id, bodega_id, producto_id, lote_id, cantidad)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (bodega_id, producto_id, lote_id)
       DO UPDATE SET cantidad = saldo_inventario.cantidad + EXCLUDED.cantidad, actualizado_en = now()`,
      [s.organizacionId, s.fincaId, s.bodegaId, s.productoId, s.loteId, s.cantidad],
    );
  }

  async insertarMovimiento(tx: Transaccion, m: NuevoMovimiento): Promise<string> {
    const r = await clienteDe(tx).query(
      `INSERT INTO movimiento_inventario
         (organizacion_id, finca_id, bodega_id, producto_id, lote_id, tipo, delta, origen_tipo, origen_id, revierte_a, creado_por, nota)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        m.organizacionId,
        m.fincaId,
        m.bodegaId,
        m.productoId,
        m.loteId,
        m.tipo,
        m.delta,
        m.origenTipo,
        m.origenId,
        m.revierteA ?? null,
        m.creadoPor,
        m.nota ?? null,
      ],
    );
    return r.rows[0].id as string;
  }

  async listarSaldos(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
    fincaId?: string,
  ): Promise<FilaSaldo[]> {
    const r = await clienteDe(tx).query(
      `SELECT s.id, f.id AS finca_id, f.nombre AS finca, b.nombre AS bodega, p.codigo AS producto_codigo,
              p.nombre AS producto, l.codigo AS lote, s.cantidad
         FROM saldo_inventario s
         JOIN finca f ON f.id = s.finca_id
         JOIN bodega b ON b.id = s.bodega_id
         JOIN producto p ON p.id = s.producto_id
         JOIN lote l ON l.id = s.lote_id
        WHERE s.organizacion_id = $1 AND s.finca_id = ANY($2::uuid[])
          AND ($3::uuid IS NULL OR s.finca_id = $3)
        ORDER BY f.nombre, p.codigo, l.codigo`,
      [organizacionId, fincaIds, fincaId ?? null],
    );
    return r.rows.map((x) => ({
      saldoId: x.id,
      fincaId: x.finca_id,
      fincaNombre: x.finca,
      bodegaNombre: x.bodega,
      productoCodigo: x.producto_codigo,
      productoNombre: x.producto,
      loteCodigo: x.lote,
      cantidad: x.cantidad,
    }));
  }
}
