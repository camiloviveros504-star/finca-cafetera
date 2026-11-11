import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorRegla } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { EtapaParaEjecutar, FilaProceso, FilaRegistroProceso, RepositorioBeneficio } from "../domain/puertos";

export class RepositorioBeneficioPg implements RepositorioBeneficio {
  async crearProceso(tx: Transaccion, p: Parameters<RepositorioBeneficio["crearProceso"]>[1]): Promise<string> {
    const c = clienteDe(tx);
    try {
      const r = await c.query("INSERT INTO proceso_tipo (organizacion_id, codigo, nombre, creado_por) VALUES ($1,$2,$3,$4) RETURNING id", [p.organizacionId, p.codigo, p.nombre, p.creadoPor]);
      const id = r.rows[0].id as string;
      let orden = 1;
      for (const e of p.etapas) {
        await c.query(
          "INSERT INTO proceso_etapa (proceso_tipo_id, orden, codigo, nombre, producto_entrada_id, producto_salida_id, merma_esperada_pct) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [id, orden++, e.codigo, e.nombre, e.productoEntradaId, e.productoSalidaId, e.mermaEsperadaPct ?? null],
        );
      }
      return id;
    } catch (error) {
      const codigo = (error as { code?: string }).code;
      if (codigo === "23505") throw new ErrorRegla("Ya existe un proceso o una etapa con ese código", "proceso_duplicado");
      throw error;
    }
  }

  async productosExisten(tx: Transaccion, organizacionId: string, ids: string[]): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT count(*)::int AS n FROM producto WHERE organizacion_id = $1 AND id = ANY($2::uuid[]) AND activo", [organizacionId, ids]);
    return r.rows[0].n === ids.length;
  }

  async listarProcesos(tx: Transaccion, organizacionId: string): Promise<FilaProceso[]> {
    const r = await clienteDe(tx).query(
      `SELECT t.id, t.codigo, t.nombre, t.es_demo,
              coalesce(json_agg(json_build_object('id', e.id, 'orden', e.orden, 'codigo', e.codigo, 'nombre', e.nombre,
                'productoEntradaId', e.producto_entrada_id, 'productoEntradaNombre', pe.nombre,
                'productoSalidaId', e.producto_salida_id, 'productoSalidaNombre', ps.nombre,
                'mermaEsperadaPct', e.merma_esperada_pct) ORDER BY e.orden) FILTER (WHERE e.id IS NOT NULL), '[]'::json) AS etapas
         FROM proceso_tipo t
         LEFT JOIN proceso_etapa e ON e.proceso_tipo_id = t.id
         LEFT JOIN producto pe ON pe.id = e.producto_entrada_id
         LEFT JOIN producto ps ON ps.id = e.producto_salida_id
        WHERE t.organizacion_id = $1 AND t.activo GROUP BY t.id ORDER BY t.nombre`,
      [organizacionId],
    );
    return r.rows.map((x) => ({ id: x.id, codigo: x.codigo, nombre: x.nombre, esDemo: x.es_demo, etapas: x.etapas }));
  }

  async obtenerEtapa(tx: Transaccion, organizacionId: string, etapaId: string): Promise<EtapaParaEjecutar | null> {
    const r = await clienteDe(tx).query(
      `SELECT e.id, e.orden, e.codigo, e.nombre, e.producto_entrada_id, pe.nombre AS entrada, e.producto_salida_id, ps.nombre AS salida,
              e.merma_esperada_pct, t.id AS tipo_id, t.nombre AS tipo_nombre
         FROM proceso_etapa e JOIN proceso_tipo t ON t.id = e.proceso_tipo_id
         JOIN producto pe ON pe.id = e.producto_entrada_id JOIN producto ps ON ps.id = e.producto_salida_id
        WHERE e.id = $1 AND t.organizacion_id = $2 AND t.activo`,
      [etapaId, organizacionId],
    );
    const x = r.rows[0];
    return x
      ? { id: x.id, orden: x.orden, codigo: x.codigo, nombre: x.nombre, productoEntradaId: x.producto_entrada_id, productoEntradaNombre: x.entrada, productoSalidaId: x.producto_salida_id, productoSalidaNombre: x.salida, mermaEsperadaPct: x.merma_esperada_pct, procesoTipoId: x.tipo_id, procesoNombre: x.tipo_nombre }
      : null;
  }

  async registroPorTransformacion(tx: Transaccion, transformacionId: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM proceso_registro WHERE transformacion_id = $1", [transformacionId]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async insertarRegistro(tx: Transaccion, r: Parameters<RepositorioBeneficio["insertarRegistro"]>[1]): Promise<string> {
    const res = await clienteDe(tx).query(
      `INSERT INTO proceso_registro (organizacion_id, finca_id, proceso_tipo_id, proceso_etapa_id, transformacion_id, fecha, entrada_total, salida_total,
                                     perdida_total, merma_pct, merma_excede_esperada, justificacion, responsable_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [r.organizacionId, r.fincaId, r.procesoTipoId, r.etapaId, r.transformacionId, r.fecha, r.entradaTotal, r.salidaTotal, r.perdidaTotal, r.mermaPct, r.excede, r.justificacion ?? null, r.responsableId],
    );
    return res.rows[0].id as string;
  }

  async listarRegistros(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], limite: number): Promise<FilaRegistroProceso[]> {
    const r = await clienteDe(tx).query(
      `SELECT g.id, g.fecha::text AS fecha, f.nombre AS finca, t.nombre AS proceso, e.nombre AS etapa, g.entrada_total, g.salida_total,
              g.perdida_total, g.merma_pct, g.merma_excede_esperada, g.justificacion, u.nombre AS responsable, g.transformacion_id
         FROM proceso_registro g JOIN finca f ON f.id = g.finca_id JOIN proceso_tipo t ON t.id = g.proceso_tipo_id
         JOIN proceso_etapa e ON e.id = g.proceso_etapa_id JOIN usuario u ON u.id = g.responsable_id
        WHERE g.organizacion_id = $1 AND g.finca_id = ANY($2::uuid[]) ORDER BY g.fecha DESC, g.creado_en DESC LIMIT $3`,
      [organizacionId, fincaIds, limite],
    );
    return r.rows.map((x) => ({
      id: x.id, fecha: x.fecha, fincaNombre: x.finca, procesoNombre: x.proceso, etapaNombre: x.etapa, entradaTotal: x.entrada_total, salidaTotal: x.salida_total,
      perdidaTotal: x.perdida_total, mermaPct: x.merma_pct, mermaExcede: x.merma_excede_esperada, justificacion: x.justificacion, responsable: x.responsable, transformacionId: x.transformacion_id,
    }));
  }
}
