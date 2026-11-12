import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { EventoLote, FilaLoteCultivo, Recomendacion, RepositorioCultivo } from "../domain/cultivo";

export class RepositorioCultivoPg implements RepositorioCultivo {
  async listarLotes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaLoteCultivo[]> {
    const r = await clienteDe(tx).query(
      `SELECT l.id, l.finca_id, f.nombre AS finca, l.codigo, l.nombre, l.area_ha, l.variedad, l.estado_productivo, l.numero_arboles,
              l.fecha_siembra::text AS fecha_siembra, l.fecha_ultima_zoca::text AS fecha_zoca,
              CASE WHEN l.estado_productivo = 'sin_sembrar' OR coalesce(l.fecha_ultima_zoca, l.fecha_siembra) IS NULL THEN NULL
                   ELSE (extract(year FROM age(current_date, coalesce(l.fecha_ultima_zoca, l.fecha_siembra))) * 12
                         + extract(month FROM age(current_date, coalesce(l.fecha_ultima_zoca, l.fecha_siembra))))::int END AS edad_meses,
              coalesce((SELECT sum(c.cantidad_base) FROM cosecha c WHERE c.lote_id = l.id AND c.estado = 'confirmada'), 0) AS cosechado,
              coalesce((SELECT json_agg(json_build_object('id', e.id, 'fecha', e.fecha, 'tipo', e.tipo, 'arboles', e.arboles, 'detalle', e.detalle) ORDER BY e.fecha DESC, e.creado_en DESC)
                          FROM (SELECT * FROM lote_evento x WHERE x.lote_id = l.id ORDER BY x.fecha DESC, x.creado_en DESC LIMIT 6) e), '[]'::json) AS eventos
         FROM lote l JOIN finca f ON f.id = l.finca_id
        WHERE l.organizacion_id = $1 AND l.finca_id = ANY($2::uuid[]) AND f.activa
        ORDER BY f.nombre, l.codigo`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({
      id: x.id, fincaId: x.finca_id, fincaNombre: x.finca, codigo: x.codigo, nombre: x.nombre, areaHa: x.area_ha, variedad: x.variedad, estado: x.estado_productivo,
      numeroArboles: x.numero_arboles, fechaSiembra: x.fecha_siembra, fechaUltimaZoca: x.fecha_zoca, edadMeses: x.edad_meses, cosechadoKg: x.cosechado,
      eventos: (x.eventos as { id: string; fecha: string; tipo: string; arboles: number | null; detalle: string | null }[]).map((e): EventoLote => ({ ...e, fecha: String(e.fecha).slice(0, 10) })),
    }));
  }

  async listarRecomendaciones(tx: Transaccion, organizacionId: string): Promise<Recomendacion[]> {
    const r = await clienteDe(tx).query("SELECT id, etapa, edad_desde_meses, edad_hasta_meses, labor, titulo, detalle, gramos_por_planta, fuente FROM recomendacion_cultivo WHERE organizacion_id = $1 ORDER BY edad_desde_meses", [organizacionId]);
    return r.rows.map((x) => ({ id: x.id, etapa: x.etapa, desdeMeses: x.edad_desde_meses, hastaMeses: x.edad_hasta_meses, labor: x.labor, titulo: x.titulo, detalle: x.detalle, gramosPorPlanta: x.gramos_por_planta, fuente: x.fuente }));
  }

  async obtenerLote(tx: Transaccion, organizacionId: string, loteId: string) {
    const r = await clienteDe(tx).query("SELECT id, finca_id, estado_productivo, numero_arboles FROM lote WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [loteId, organizacionId]);
    const x = r.rows[0];
    return x ? { id: x.id as string, fincaId: x.finca_id as string, estado: x.estado_productivo as string, numeroArboles: x.numero_arboles as number | null } : null;
  }

  async aplicarEvento(tx: Transaccion, e: { organizacionId: string; loteId: string; tipo: string; fecha: string; arboles?: number; variedad?: string; detalle?: string; creadoPor: string }) {
    const c = clienteDe(tx);
    await c.query("INSERT INTO lote_evento (organizacion_id, lote_id, fecha, tipo, arboles, detalle, creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7)", [e.organizacionId, e.loteId, e.fecha, e.tipo, e.arboles ?? null, e.detalle ?? null, e.creadoPor]);
    if (e.tipo === "siembra" || e.tipo === "resiembra") {
      await c.query("UPDATE lote SET estado_productivo = 'levante', fecha_siembra = $2, numero_arboles = $3, variedad = $4, fecha_ultima_zoca = NULL WHERE id = $1", [e.loteId, e.fecha, e.arboles, e.variedad ?? null]);
    } else if (e.tipo === "zoca") {
      await c.query("UPDATE lote SET estado_productivo = 'zoca', fecha_ultima_zoca = $2 WHERE id = $1", [e.loteId, e.fecha]);
    } else if (e.tipo === "tumba") {
      await c.query("UPDATE lote SET estado_productivo = 'sin_sembrar', numero_arboles = NULL, variedad = NULL, fecha_siembra = NULL, fecha_ultima_zoca = NULL WHERE id = $1", [e.loteId]);
    }
  }

  async eliminarLote(tx: Transaccion, organizacionId: string, loteId: string): Promise<"eliminado" | "con_historial"> {
    const c = clienteDe(tx);
    await c.query("SAVEPOINT eliminar_lote");
    try {
      await c.query("DELETE FROM lote_evento WHERE lote_id = $1 AND organizacion_id = $2", [loteId, organizacionId]);
      const r = await c.query("DELETE FROM lote WHERE id = $1 AND organizacion_id = $2", [loteId, organizacionId]);
      await c.query("RELEASE SAVEPOINT eliminar_lote");
      return r.rowCount === 1 ? "eliminado" : "con_historial";
    } catch (error) {
      await c.query("ROLLBACK TO SAVEPOINT eliminar_lote");
      if ((error as { code?: string }).code === "23503") return "con_historial"; // tiene cosechas, movimientos, gastos o aplicaciones
      throw error;
    }
  }
}
