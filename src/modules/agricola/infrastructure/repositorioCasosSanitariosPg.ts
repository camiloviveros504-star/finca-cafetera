import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import { NOMBRE_PLAGA, type CasoSanitario, type EstadoCaso, type RepositorioCasosSanitarios, type TipoPlaga } from "../domain/casosSanitarios";

export class RepositorioCasosSanitariosPg implements RepositorioCasosSanitarios {
  async loteDeOrganizacion(tx: Transaccion, organizacionId: string, loteId: string) {
    const r = await clienteDe(tx).query("SELECT finca_id FROM lote WHERE id = $1 AND organizacion_id = $2", [loteId, organizacionId]);
    return r.rows[0] ? { fincaId: r.rows[0].finca_id as string } : null;
  }

  async buscarPorClave(tx: Transaccion, organizacionId: string, clave: string) {
    const r = await clienteDe(tx).query("SELECT id FROM caso_sanitario WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async crear(tx: Transaccion, c: Parameters<RepositorioCasosSanitarios["crear"]>[1]) {
    const cl = clienteDe(tx);
    const r = await cl.query(
      `INSERT INTO caso_sanitario (organizacion_id, finca_id, lote_id, tipo, otro_nombre, severidad, afectacion_pct, descripcion, detectado_en, clave_idempotencia, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [c.organizacionId, c.fincaId, c.loteId, c.tipo, c.otroNombre ?? null, c.severidad, c.afectacionPct ?? null, c.descripcion, c.detectadoEn, c.clave, c.creadoPor],
    );
    const id = r.rows[0].id as string;
    // El reporte inicial queda como primer paso del historial.
    await cl.query("INSERT INTO caso_sanitario_seguimiento (organizacion_id, caso_id, fecha, estado, nota, registrado_por) VALUES ($1,$2,$3,'detectado',$4,$5)", [c.organizacionId, id, c.detectadoEn, c.descripcion, c.creadoPor]);
    return id;
  }

  async bloquear(tx: Transaccion, organizacionId: string, casoId: string) {
    const r = await clienteDe(tx).query("SELECT id, finca_id, lote_id, estado, detectado_en::text AS detectado FROM caso_sanitario WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [casoId, organizacionId]);
    const x = r.rows[0];
    return x ? { id: x.id as string, fincaId: x.finca_id as string, loteId: x.lote_id as string, estado: x.estado as EstadoCaso, detectadoEn: x.detectado as string } : null;
  }

  async aplicacionDelLote(tx: Transaccion, organizacionId: string, aplicacionId: string, loteId: string) {
    const r = await clienteDe(tx).query("SELECT 1 FROM aplicacion_agroquimica WHERE id = $1 AND organizacion_id = $2 AND lote_id = $3", [aplicacionId, organizacionId, loteId]);
    return r.rowCount === 1;
  }

  async agregarSeguimiento(tx: Transaccion, s: Parameters<RepositorioCasosSanitarios["agregarSeguimiento"]>[1]) {
    const c = clienteDe(tx);
    await c.query("INSERT INTO caso_sanitario_seguimiento (organizacion_id, caso_id, fecha, estado, nota, aplicacion_id, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7)", [s.organizacionId, s.casoId, s.fecha, s.estado, s.nota, s.aplicacionId ?? null, s.registradoPor]);
    await c.query("UPDATE caso_sanitario SET estado = $2, controlado_en = CASE WHEN $2 = 'controlado' THEN $3::date ELSE NULL END WHERE id = $1", [s.casoId, s.estado, s.fecha]);
  }

  async listar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloAbiertos: boolean): Promise<CasoSanitario[]> {
    const r = await clienteDe(tx).query(
      `SELECT c.id, c.finca_id, f.nombre AS finca, c.lote_id, l.codigo, l.nombre AS lote, c.tipo, c.otro_nombre, c.severidad, c.afectacion_pct, c.descripcion, c.estado,
              c.detectado_en::text AS detectado, c.controlado_en::text AS controlado, (coalesce(c.controlado_en, current_date) - c.detectado_en) AS dias,
              coalesce((SELECT json_agg(json_build_object('id', s.id, 'fecha', s.fecha::text, 'estado', s.estado, 'nota', s.nota, 'responsable', u.nombre,
                                                          'aplicacion', CASE WHEN a.id IS NULL THEN NULL ELSE ag.nombre || ' · ' || a.cantidad_total::text || ' ' || ag.unidad END)
                                         ORDER BY s.fecha DESC, s.creado_en DESC)
                          FROM caso_sanitario_seguimiento s JOIN usuario u ON u.id = s.registrado_por
                          LEFT JOIN aplicacion_agroquimica a ON a.id = s.aplicacion_id LEFT JOIN agroquimico_stock st ON st.id = a.stock_id LEFT JOIN agroquimico ag ON ag.id = st.agroquimico_id
                         WHERE s.caso_id = c.id), '[]'::json) AS seguimientos
         FROM caso_sanitario c JOIN lote l ON l.id = c.lote_id JOIN finca f ON f.id = c.finca_id
        WHERE c.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[]) AND ($3::boolean = false OR c.estado <> 'controlado')
        ORDER BY (c.estado = 'controlado'), CASE c.severidad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, c.detectado_en DESC
        LIMIT 300`,
      [organizacionId, fincaIds, soloAbiertos],
    );
    return r.rows.map((x) => ({
      id: x.id, fincaId: x.finca_id, fincaNombre: x.finca, loteId: x.lote_id, loteCodigo: x.codigo, loteNombre: x.lote,
      tipo: x.tipo as TipoPlaga, nombre: x.tipo === "otra" ? (x.otro_nombre as string) : NOMBRE_PLAGA[x.tipo as TipoPlaga],
      severidad: x.severidad, afectacionPct: x.afectacion_pct, descripcion: x.descripcion, estado: x.estado as EstadoCaso,
      detectadoEn: x.detectado, controladoEn: x.controlado, diasAbierto: Number(x.dias), seguimientos: x.seguimientos,
    }));
  }
}
