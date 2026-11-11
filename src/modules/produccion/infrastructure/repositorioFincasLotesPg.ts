import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorRegla } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { FilaLote, RepositorioFincasLotes } from "../domain/puertos";

export class RepositorioFincasLotesPg implements RepositorioFincasLotes {
  async crearFinca(tx: Transaccion, f: { organizacionId: string; nombre: string; ubicacion?: string; areaHa?: string; creadoPor: string }): Promise<string> {
    const c = clienteDe(tx);
    try {
      const r = await c.query("INSERT INTO finca (organizacion_id, nombre, ubicacion, area_ha) VALUES ($1,$2,$3,$4) RETURNING id", [
        f.organizacionId,
        f.nombre,
        f.ubicacion ?? null,
        f.areaHa ?? null,
      ]);
      const id = r.rows[0].id as string;
      // Quien crea la finca queda con acceso; se crea una bodega principal para poder registrar cosechas.
      await c.query("INSERT INTO usuario_finca (usuario_id, finca_id) VALUES ($1,$2)", [f.creadoPor, id]);
      await c.query("INSERT INTO bodega (organizacion_id, finca_id, nombre) VALUES ($1,$2,'Bodega principal')", [f.organizacionId, id]);
      return id;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorRegla("Ya existe una finca con ese nombre", "finca_duplicada");
      throw error;
    }
  }

  async crearLote(
    tx: Transaccion,
    l: { organizacionId: string; fincaId: string; codigo: string; nombre: string; areaHa?: string; variedad?: string; numeroArboles?: number; fechaSiembra?: string; creadoPor?: string },
  ): Promise<string> {
    try {
      // Con fecha de siembra el lote nace sembrado (levante o producción según su edad); sin ella, nace sin sembrar.
      const r = await clienteDe(tx).query(
        `INSERT INTO lote (organizacion_id, finca_id, codigo, nombre, area_ha, variedad, numero_arboles, fecha_siembra, estado_productivo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,
                 CASE WHEN $8::date IS NULL THEN 'sin_sembrar' WHEN $8::date <= current_date - interval '24 months' THEN 'produccion' ELSE 'levante' END)
         RETURNING id`,
        [l.organizacionId, l.fincaId, l.codigo, l.nombre, l.areaHa ?? null, l.variedad ?? null, l.fechaSiembra ? (l.numeroArboles ?? null) : null, l.fechaSiembra ?? null],
      );
      if (l.fechaSiembra && l.creadoPor) {
        await clienteDe(tx).query("INSERT INTO lote_evento (organizacion_id, lote_id, fecha, tipo, arboles, detalle, creado_por) VALUES ($1,$2,$3,'siembra',$4,'Registro inicial del lote',$5)", [l.organizacionId, r.rows[0].id, l.fechaSiembra, l.numeroArboles ?? null, l.creadoPor]);
      }
      return r.rows[0].id as string;
    } catch (error) {
      const codigo = (error as { code?: string }).code;
      if (codigo === "23505") throw new ErrorRegla("Ya existe un lote con ese código en la finca", "lote_duplicado");
      if (codigo === "23503") throw new ErrorRegla("La finca no existe", "finca_invalida");
      throw error;
    }
  }

  async listarFincas(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT f.id, f.nombre, f.ubicacion, f.area_ha, (SELECT count(*)::int FROM lote l WHERE l.finca_id = f.id) AS lotes
         FROM finca f WHERE f.organizacion_id = $1 AND f.id = ANY($2::uuid[]) ORDER BY f.nombre`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({
      id: x.id as string,
      nombre: x.nombre as string,
      ubicacion: x.ubicacion as string | null,
      areaHa: x.area_ha as string | null,
      lotes: x.lotes as number,
    }));
  }

  async listarLotes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaLote[]> {
    const r = await clienteDe(tx).query(
      `SELECT l.id, l.finca_id, f.nombre AS finca, l.codigo, l.nombre, l.area_ha, l.variedad, l.estado_productivo,
              coalesce((SELECT sum(c.cantidad_base) FROM cosecha c WHERE c.lote_id = l.id AND c.estado = 'confirmada'), 0) AS cosechado
         FROM lote l JOIN finca f ON f.id = l.finca_id
        WHERE l.organizacion_id = $1 AND l.finca_id = ANY($2::uuid[]) ORDER BY f.nombre, l.codigo`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({
      id: x.id,
      fincaId: x.finca_id,
      fincaNombre: x.finca,
      codigo: x.codigo,
      nombre: x.nombre,
      areaHa: x.area_ha,
      variedad: x.variedad,
      estadoProductivo: x.estado_productivo,
      cosechadoKg: x.cosechado,
    }));
  }
}
