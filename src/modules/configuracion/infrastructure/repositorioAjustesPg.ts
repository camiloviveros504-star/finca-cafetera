import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorRegla } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { Equivalencia, ParametroConfigurado, RepositorioAjustes, ValorCatalogo } from "../domain/ajustes";

export class RepositorioAjustesPg implements RepositorioAjustes {
  async listarCatalogos(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<ValorCatalogo[]> {
    const r = await clienteDe(tx).query(
      `SELECT c.id, c.catalogo, c.codigo, c.nombre, c.activo, c.finca_id, f.nombre AS finca
         FROM catalogo_valor c LEFT JOIN finca f ON f.id = c.finca_id
        WHERE c.organizacion_id = $1 AND (c.finca_id IS NULL OR c.finca_id = ANY($2::uuid[]))
        ORDER BY c.catalogo, c.finca_id NULLS FIRST, c.nombre`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, catalogo: x.catalogo, codigo: x.codigo, nombre: x.nombre, activo: x.activo, fincaId: x.finca_id, fincaNombre: x.finca }));
  }
  async codigoEnUso(tx: Transaccion, o: string, catalogo: string, codigo: string, fincaId: string) {
    const r = await clienteDe(tx).query("SELECT 1 FROM catalogo_valor WHERE organizacion_id = $1 AND catalogo = $2 AND codigo = $3 AND (finca_id IS NULL OR finca_id = $4)", [o, catalogo, codigo, fincaId]);
    return (r.rowCount ?? 0) > 0;
  }
  async crearValorCatalogo(tx: Transaccion, v: Parameters<RepositorioAjustes["crearValorCatalogo"]>[1]): Promise<string> {
    try {
      const r = await clienteDe(tx).query("INSERT INTO catalogo_valor (organizacion_id, finca_id, catalogo, codigo, nombre) VALUES ($1,$2,$3,$4,$5) RETURNING id", [v.organizacionId, v.fincaId, v.catalogo, v.codigo, v.nombre]);
      return r.rows[0].id as string;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorRegla("Ya existe ese valor en el catálogo", "valor_duplicado");
      throw error;
    }
  }
  async cambiarEstadoValor(tx: Transaccion, o: string, id: string, activo: boolean, fincaIds: readonly string[]): Promise<boolean> {
    const r = await clienteDe(tx).query("UPDATE catalogo_valor SET activo = $3 WHERE id = $1 AND organizacion_id = $2 AND finca_id = ANY($4::uuid[])", [id, o, activo, fincaIds]);
    return r.rowCount === 1;
  }
  async listarEquivalencias(tx: Transaccion, o: string, hoy: string, fincaIds: readonly string[]): Promise<Equivalencia[]> {
    const r = await clienteDe(tx).query(
      `SELECT c.id, c.finca_id, f.nombre AS finca, uo.codigo AS origen, ud.codigo AS destino, c.factor, lower(c.vigencia)::text AS desde,
              upper(c.vigencia)::text AS hasta, c.es_demo, (c.vigencia @> $2::date) AS vigente
         FROM conversion_unidad c JOIN unidad uo ON uo.id = c.unidad_origen_id JOIN unidad ud ON ud.id = c.unidad_destino_id LEFT JOIN finca f ON f.id = c.finca_id
        WHERE c.organizacion_id = $1 AND (c.finca_id IS NULL OR c.finca_id = ANY($3::uuid[]))
        ORDER BY f.nombre NULLS FIRST, uo.codigo, ud.codigo, lower(c.vigencia) DESC`,
      [o, hoy, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, fincaId: x.finca_id, fincaNombre: x.finca, origen: x.origen, destino: x.destino, factor: x.factor, desde: x.desde, hasta: x.hasta, esDemo: x.es_demo, vigente: x.vigente }));
  }
  async unidadId(tx: Transaccion, codigo: string) {
    const r = await clienteDe(tx).query("SELECT id, tipo FROM unidad WHERE codigo = $1", [codigo]);
    return r.rows[0] ? { id: r.rows[0].id as string, tipo: r.rows[0].tipo as string } : null;
  }
  async ultimaEquivalencia(tx: Transaccion, o: string, fincaId: string | null, origenId: string, destinoId: string) {
    const r = await clienteDe(tx).query(
      `SELECT id, lower(vigencia)::text AS desde, upper(vigencia)::text AS hasta FROM conversion_unidad
        WHERE organizacion_id = $1 AND finca_id IS NOT DISTINCT FROM $2::uuid AND unidad_origen_id = $3 AND unidad_destino_id = $4
        ORDER BY lower(vigencia) DESC LIMIT 1 FOR UPDATE`,
      [o, fincaId, origenId, destinoId],
    );
    return r.rows[0] ? { id: r.rows[0].id as string, desde: r.rows[0].desde as string, hasta: (r.rows[0].hasta as string) ?? null } : null;
  }
  async cerrarEquivalencia(tx: Transaccion, id: string, hasta: string) {
    await clienteDe(tx).query("UPDATE conversion_unidad SET vigencia = daterange(lower(vigencia), $2::date, '[)') WHERE id = $1", [id, hasta]);
  }
  async insertarEquivalencia(tx: Transaccion, e: Parameters<RepositorioAjustes["insertarEquivalencia"]>[1]): Promise<string> {
    try {
      const r = await clienteDe(tx).query(
        "INSERT INTO conversion_unidad (organizacion_id, finca_id, unidad_origen_id, unidad_destino_id, factor, vigencia, creada_por) VALUES ($1,$2,$3,$4,$5, daterange($6::date, NULL, '[)'), $7) RETURNING id",
        [e.organizacionId, e.fincaId, e.origenId, e.destinoId, e.factor, e.desde, e.creadaPor],
      );
      return r.rows[0].id as string;
    } catch (error) {
      if ((error as { code?: string }).code === "23P01") throw new ErrorRegla("La vigencia se solapa con otra equivalencia de la misma finca", "vigencia_solapada");
      throw error;
    }
  }
  async listarParametros(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<ParametroConfigurado[]> {
    const r = await clienteDe(tx).query(
      `SELECT p.clave, p.valor #>> '{}' AS valor, p.finca_id, f.nombre AS finca, p.actualizado_en::text AS actualizado
         FROM parametro p LEFT JOIN finca f ON f.id = p.finca_id
        WHERE p.organizacion_id = $1 AND (p.finca_id IS NULL OR p.finca_id = ANY($2::uuid[])) ORDER BY p.clave, f.nombre NULLS FIRST`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({ clave: x.clave, valor: x.valor, fincaId: x.finca_id, fincaNombre: x.finca, actualizadoEn: x.actualizado }));
  }
  async guardarParametro(tx: Transaccion, p: { organizacionId: string; fincaId: string | null; clave: string; valor: string; usuarioId: string }) {
    const c = clienteDe(tx);
    const previo = await c.query("SELECT valor #>> '{}' AS valor FROM parametro WHERE organizacion_id = $1 AND finca_id IS NOT DISTINCT FROM $2::uuid AND clave = $3 FOR UPDATE", [p.organizacionId, p.fincaId, p.clave]);
    await c.query(
      `INSERT INTO parametro (organizacion_id, finca_id, clave, valor, actualizado_por) VALUES ($1,$2,$3,to_jsonb($4::text),$5)
       ON CONFLICT (organizacion_id, COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid), clave)
       DO UPDATE SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
      [p.organizacionId, p.fincaId, p.clave, p.valor, p.usuarioId],
    );
    return { anterior: (previo.rows[0]?.valor as string) ?? null };
  }
  async obtenerParametro(tx: Transaccion, o: string, fincaId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query(
      "SELECT valor #>> '{}' AS valor FROM parametro WHERE organizacion_id = $1 AND clave = $3 AND (finca_id = $2 OR finca_id IS NULL) ORDER BY finca_id NULLS LAST LIMIT 1",
      [o, fincaId, clave],
    );
    return r.rows[0] ? (r.rows[0].valor as string) : null;
  }
}
