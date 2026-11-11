import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorClaveDuplicada } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type {
  FilaMovimiento,
  LineaTransformacion,
  MovimientoRegistrado,
  NuevaTransformacion,
  NuevoMovimiento,
  RepositorioOperacionesInventario,
  SaldoExacto,
  Ubicacion,
} from "../domain/puertos";

const COLUMNAS = `id, tipo, delta, origen_tipo, origen_id, revierte_a, finca_id, bodega_id, producto_id, lote_id, creado_en`;

function aMovimiento(x: Record<string, unknown>): MovimientoRegistrado {
  return {
    id: x.id as string,
    tipo: x.tipo as string,
    delta: x.delta as string,
    origenTipo: x.origen_tipo as string,
    origenId: (x.origen_id as string) ?? null,
    revierteA: (x.revierte_a as string) ?? null,
    fincaId: x.finca_id as string,
    bodegaId: x.bodega_id as string,
    productoId: x.producto_id as string,
    loteId: x.lote_id as string,
    creadoEn: (x.creado_en as Date).toISOString(),
  };
}

export class RepositorioOperacionesPg implements RepositorioOperacionesInventario {
  async ubicacionValida(tx: Transaccion, organizacionId: string, u: Ubicacion): Promise<boolean> {
    const r = await clienteDe(tx).query(
      `SELECT 1
         FROM bodega b, lote l, producto p
        WHERE b.id = $1 AND b.finca_id = $2 AND b.organizacion_id = $5
          AND l.id = $3 AND l.finca_id = $2 AND l.organizacion_id = $5
          AND p.id = $4 AND p.organizacion_id = $5 AND p.activo`,
      [u.bodegaId, u.fincaId, u.loteId, u.productoId, organizacionId],
    );
    return r.rowCount === 1;
  }

  async bloquearSaldoExacto(tx: Transaccion, u: { bodegaId: string; productoId: string; loteId: string }): Promise<SaldoExacto | null> {
    const r = await clienteDe(tx).query(
      "SELECT id, cantidad FROM saldo_inventario WHERE bodega_id = $1 AND producto_id = $2 AND lote_id = $3 FOR UPDATE",
      [u.bodegaId, u.productoId, u.loteId],
    );
    return r.rows[0] ? { id: r.rows[0].id, cantidad: r.rows[0].cantidad } : null;
  }

  async buscarMovimientoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<MovimientoRegistrado | null> {
    const r = await clienteDe(tx).query(`SELECT ${COLUMNAS} FROM movimiento_inventario WHERE organizacion_id = $1 AND clave_idempotencia = $2`, [
      organizacionId,
      clave,
    ]);
    return r.rows[0] ? aMovimiento(r.rows[0]) : null;
  }

  async obtenerMovimiento(tx: Transaccion, organizacionId: string, id: string): Promise<MovimientoRegistrado | null> {
    const r = await clienteDe(tx).query(`SELECT ${COLUMNAS} FROM movimiento_inventario WHERE organizacion_id = $1 AND id = $2`, [organizacionId, id]);
    return r.rows[0] ? aMovimiento(r.rows[0]) : null;
  }

  async insertarMovimientoConClave(tx: Transaccion, m: NuevoMovimiento & { clave: string | null }): Promise<string> {
    try {
      const r = await clienteDe(tx).query(
        `INSERT INTO movimiento_inventario
           (organizacion_id, finca_id, bodega_id, producto_id, lote_id, tipo, delta, origen_tipo, origen_id, revierte_a, clave_idempotencia, creado_por, nota)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [m.organizacionId, m.fincaId, m.bodegaId, m.productoId, m.loteId, m.tipo, m.delta, m.origenTipo, m.origenId, m.revierteA ?? null, m.clave, m.creadoPor, m.nota ?? null],
      );
      return r.rows[0].id as string;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorClaveDuplicada();
      throw error;
    }
  }

  async insertarTransformacion(tx: Transaccion, t: NuevaTransformacion): Promise<void> {
    try {
      await clienteDe(tx).query(
        `INSERT INTO transformacion (id, organizacion_id, finca_id, bodega_id, tipo, fecha, factor_rendimiento, clave_idempotencia, creado_por, nota)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [t.id, t.organizacionId, t.fincaId, t.bodegaId, t.tipo, t.fecha, t.factorRendimiento, t.clave, t.creadoPor, t.nota ?? null],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorClaveDuplicada();
      throw error;
    }
  }

  async insertarLineaTransformacion(tx: Transaccion, l: LineaTransformacion): Promise<void> {
    await clienteDe(tx).query(
      `INSERT INTO transformacion_linea (transformacion_id, lote_id, finca_id, producto_entrada_id, producto_salida_id, cantidad_entrada, cantidad_salida, cantidad_perdida)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [l.transformacionId, l.loteId, l.fincaId, l.productoEntradaId, l.productoSalidaId, l.cantidadEntrada, l.cantidadSalida, l.cantidadPerdida],
    );
  }

  async transformacionPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM transformacion WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0]?.id ?? null;
  }

  async yaReversado(tx: Transaccion, movimientoId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM movimiento_inventario WHERE revierte_a = $1", [movimientoId]);
    return (r.rowCount ?? 0) > 0;
  }

  async listarMovimientos(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
    limite: number,
    desplazamiento: number,
  ): Promise<{ filas: FilaMovimiento[]; total: number }> {
    const c = clienteDe(tx);
    const [filas, total] = await Promise.all([
      c.query(
        `SELECT m.id, m.creado_en, m.tipo, m.delta, p.nombre AS producto, l.codigo AS lote, b.nombre AS bodega, f.nombre AS finca,
                m.origen_tipo, m.nota,
                (m.origen_tipo IN ('ajuste','manual') AND m.tipo <> 'reverso'
                  AND NOT EXISTS (SELECT 1 FROM movimiento_inventario r WHERE r.revierte_a = m.id)) AS reversible
           FROM movimiento_inventario m
           JOIN producto p ON p.id = m.producto_id JOIN lote l ON l.id = m.lote_id
           JOIN bodega b ON b.id = m.bodega_id JOIN finca f ON f.id = m.finca_id
          WHERE m.organizacion_id = $1 AND m.finca_id = ANY($2::uuid[])
          ORDER BY m.creado_en DESC, m.id LIMIT $3 OFFSET $4`,
        [organizacionId, fincaIds, limite, desplazamiento],
      ),
      c.query("SELECT count(*)::int AS n FROM movimiento_inventario WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[])", [organizacionId, fincaIds]),
    ]);
    return {
      filas: filas.rows.map((x) => ({
        id: x.id,
        fecha: (x.creado_en as Date).toISOString(),
        tipo: x.tipo,
        delta: x.delta,
        producto: x.producto,
        lote: x.lote,
        bodega: x.bodega,
        finca: x.finca,
        origenTipo: x.origen_tipo,
        nota: x.nota,
        reversible: x.reversible,
      })),
      total: total.rows[0].n,
    };
  }
}
