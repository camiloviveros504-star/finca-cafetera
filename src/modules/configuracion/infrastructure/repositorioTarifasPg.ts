import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { FilaTarifa, RepositorioTarifas } from "../domain/puertos";

export class RepositorioTarifasPg implements RepositorioTarifas {
  async bloquearTarifa(tx: Transaccion, organizacionId: string, tarifaId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM tarifa WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [tarifaId, organizacionId]);
    return r.rowCount === 1;
  }

  async ultimaVersion(tx: Transaccion, tarifaId: string) {
    const r = await clienteDe(tx).query(
      `SELECT id, version, lower(vigencia)::text AS desde, upper(vigencia)::text AS hasta
         FROM tarifa_version WHERE tarifa_id = $1 ORDER BY version DESC LIMIT 1`,
      [tarifaId],
    );
    return r.rows[0] ? { id: r.rows[0].id as string, version: r.rows[0].version as number, desde: r.rows[0].desde as string, hasta: (r.rows[0].hasta as string) ?? null } : null;
  }

  async cerrarVigencia(tx: Transaccion, versionId: string, hasta: string): Promise<void> {
    await clienteDe(tx).query("UPDATE tarifa_version SET vigencia = daterange(lower(vigencia), $2::date, '[)') WHERE id = $1", [versionId, hasta]);
  }

  async insertarVersion(tx: Transaccion, v: { tarifaId: string; version: number; valor: string; desde: string; creadaPor: string }): Promise<string> {
    const r = await clienteDe(tx).query(
      "INSERT INTO tarifa_version (tarifa_id, version, valor, vigencia, creada_por) VALUES ($1,$2,$3, daterange($4::date, NULL, '[)'), $5) RETURNING id",
      [v.tarifaId, v.version, v.valor, v.desde, v.creadaPor],
    );
    return r.rows[0].id as string;
  }

  async listar(tx: Transaccion, organizacionId: string, hoy: string): Promise<FilaTarifa[]> {
    const r = await clienteDe(tx).query(
      `SELECT t.id, t.codigo, t.tipo, p.nombre AS producto, u.codigo AS unidad,
              vig.valor AS valor_vigente, vig.version AS version_vigente,
              (SELECT count(*)::int FROM tarifa_version x WHERE x.tarifa_id = t.id) AS versiones,
              ult.version AS ultima, upper(ult.vigencia)::text AS ultima_hasta, lower(ult.vigencia)::text AS ultima_desde,
              ult.es_demo
         FROM tarifa t
         JOIN unidad u ON u.id = t.unidad_id
         LEFT JOIN producto p ON p.id = t.producto_id
         LEFT JOIN tarifa_version vig ON vig.tarifa_id = t.id AND vig.vigencia @> $2::date
         JOIN LATERAL (SELECT * FROM tarifa_version x WHERE x.tarifa_id = t.id ORDER BY x.version DESC LIMIT 1) ult ON true
        WHERE t.organizacion_id = $1
        ORDER BY t.codigo, p.nombre`,
      [organizacionId, hoy],
    );
    return r.rows.map((x) => ({
      tarifaId: x.id,
      codigo: x.codigo,
      tipo: x.tipo,
      productoNombre: x.producto,
      unidad: x.unidad,
      valorVigente: x.valor_vigente,
      versionVigente: x.version_vigente,
      versiones: x.versiones,
      ultimaVersion: x.ultima,
      ultimaVigenciaHasta: x.ultima_hasta,
      ultimaVigenciaDesde: x.ultima_desde,
      esDemo: x.es_demo,
    }));
  }

  async historial(tx: Transaccion, organizacionId: string, tarifaId: string) {
    const r = await clienteDe(tx).query(
      `SELECT v.version, v.valor, lower(v.vigencia)::text AS desde, upper(v.vigencia)::text AS hasta, v.creada_en, v.es_demo
         FROM tarifa_version v JOIN tarifa t ON t.id = v.tarifa_id
        WHERE t.id = $1 AND t.organizacion_id = $2 ORDER BY v.version DESC`,
      [tarifaId, organizacionId],
    );
    return r.rows.map((x) => ({ version: x.version, valor: x.valor, desde: x.desde, hasta: x.hasta, creadaEn: (x.creada_en as Date).toISOString(), esDemo: x.es_demo }));
  }
}
