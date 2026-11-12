import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { PrecioVigente, RepositorioConfiguracion } from "../domain/puertos";

export class RepositorioConfiguracionPg implements RepositorioConfiguracion {
  async parametro(tx: Transaccion, organizacionId: string, fincaId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query(
      "SELECT valor #>> '{}' AS valor FROM parametro WHERE organizacion_id = $1 AND clave = $3 AND (finca_id = $2 OR finca_id IS NULL) ORDER BY finca_id NULLS LAST LIMIT 1",
      [organizacionId, fincaId, clave],
    );
    return r.rows[0] ? (r.rows[0].valor as string) : null;
  }

  async tarifaPagoVigente(tx: Transaccion, organizacionId: string, fincaId: string, trabajadorId: string, tipo: string, fecha: string): Promise<PrecioVigente | null> {
    const r = await clienteDe(tx).query(
      `SELECT v.valor, v.id
         FROM tarifa t JOIN tarifa_version v ON v.tarifa_id = t.id
        WHERE t.organizacion_id = $1 AND t.tipo = $2 AND t.estado = 'activa'
          AND (t.trabajador_id = $3 OR t.trabajador_id IS NULL)
          AND (t.finca_id = $4 OR t.finca_id IS NULL)
          AND v.vigencia @> $5::date
        ORDER BY (t.trabajador_id IS NULL), (t.finca_id IS NULL)
        LIMIT 1`,
      [organizacionId, tipo, trabajadorId, fincaId, fecha],
    );
    const f = r.rows[0];
    return f ? { valor: f.valor as string, tarifaVersionId: f.id as string } : null;
  }

  async precioVigente(
    tx: Transaccion,
    organizacionId: string,
    fincaId: string,
    productoId: string,
    fecha: string,
  ): Promise<PrecioVigente | null> {
    const r = await clienteDe(tx).query(
      `SELECT v.valor, v.id
         FROM tarifa t JOIN tarifa_version v ON v.tarifa_id = t.id
        WHERE t.organizacion_id = $1 AND t.producto_id = $2 AND t.tipo = 'precio_venta' AND t.estado = 'activa'
          AND (t.finca_id = $3 OR t.finca_id IS NULL)
          AND v.vigencia @> $4::date
        ORDER BY t.finca_id NULLS LAST
        LIMIT 1`,
      [organizacionId, productoId, fincaId, fecha],
    );
    const f = r.rows[0];
    return f ? { valor: f.valor as string, tarifaVersionId: f.id as string } : null;
  }

  async unidadPorCodigo(tx: Transaccion, codigo: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM unidad WHERE codigo = $1", [codigo]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async factorConversion(
    tx: Transaccion,
    organizacionId: string,
    fincaId: string,
    origenId: string,
    destinoId: string,
    fecha: string,
  ): Promise<string | null> {
    const r = await clienteDe(tx).query(
      `SELECT factor FROM conversion_unidad
        WHERE organizacion_id = $1 AND unidad_origen_id = $2 AND unidad_destino_id = $3
          AND (finca_id = $4 OR finca_id IS NULL) AND vigencia @> $5::date
        ORDER BY finca_id NULLS LAST LIMIT 1`,
      [organizacionId, origenId, destinoId, fincaId, fecha],
    );
    return r.rows[0] ? (r.rows[0].factor as string) : null;
  }
}
