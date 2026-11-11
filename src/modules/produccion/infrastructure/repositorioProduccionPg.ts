import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorClaveDuplicada } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type {
  CosechaRegistrada,
  NuevaCosecha,
  OpcionesRegistro,
  RepositorioProduccion,
} from "../domain/puertos";

const SQL_COSECHA = `SELECT c.id, c.finca_id, c.lote_id, l.codigo AS lote, p.nombre AS producto, c.fecha::text AS fecha,
                            c.cantidad, u.codigo AS unidad, c.estado
                       FROM cosecha c JOIN lote l ON l.id = c.lote_id JOIN producto p ON p.id = c.producto_id
                       JOIN unidad u ON u.id = c.unidad_id`;

function aCosecha(x: Record<string, unknown>): CosechaRegistrada {
  return {
    id: x.id as string,
    fincaId: x.finca_id as string,
    loteId: x.lote_id as string,
    loteCodigo: x.lote as string,
    productoNombre: x.producto as string,
    fecha: x.fecha as string,
    cantidad: x.cantidad as string,
    unidadCodigo: x.unidad as string,
    estado: x.estado as string,
  };
}

export class RepositorioProduccionPg implements RepositorioProduccion {
  async buscarCosechaPorClave(tx: Transaccion, clave: string, organizacionId: string): Promise<CosechaRegistrada | null> {
    const r = await clienteDe(tx).query(`${SQL_COSECHA} WHERE c.clave_idempotencia = $1 AND c.organizacion_id = $2`, [
      clave,
      organizacionId,
    ]);
    return r.rows[0] ? aCosecha(r.rows[0]) : null;
  }

  async loteEsDeFinca(tx: Transaccion, organizacionId: string, loteId: string, fincaId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM lote WHERE id = $1 AND finca_id = $2 AND organizacion_id = $3", [
      loteId,
      fincaId,
      organizacionId,
    ]);
    return r.rowCount === 1;
  }

  async bodegaEsDeFinca(tx: Transaccion, organizacionId: string, bodegaId: string, fincaId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM bodega WHERE id = $1 AND finca_id = $2 AND organizacion_id = $3", [
      bodegaId,
      fincaId,
      organizacionId,
    ]);
    return r.rowCount === 1;
  }

  async unidadDeProducto(tx: Transaccion, organizacionId: string, productoId: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT unidad_id FROM producto WHERE id = $1 AND organizacion_id = $2 AND activo", [
      productoId,
      organizacionId,
    ]);
    return r.rows[0] ? (r.rows[0].unidad_id as string) : null;
  }

  async insertarCosecha(tx: Transaccion, c: NuevaCosecha): Promise<void> {
    try {
      await clienteDe(tx).query(
        `INSERT INTO cosecha (id, organizacion_id, finca_id, lote_id, producto_id, bodega_id, fecha, cantidad, unidad_id,
                              cantidad_base, factor_aplicado, clave_idempotencia, capturada_en, registrado_por, nota)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [c.id, c.organizacionId, c.fincaId, c.loteId, c.productoId, c.bodegaId, c.fecha, c.cantidad, c.unidadId, c.cantidadBase, c.factorAplicado, c.clave, c.capturadaEn, c.registradoPor, c.nota ?? null],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorClaveDuplicada();
      throw error;
    }
  }

  async obtenerCosecha(tx: Transaccion, id: string): Promise<CosechaRegistrada | null> {
    const r = await clienteDe(tx).query(`${SQL_COSECHA} WHERE c.id = $1`, [id]);
    return r.rows[0] ? aCosecha(r.rows[0]) : null;
  }

  async listarCosechas(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
    limite: number,
    desplazamiento: number,
  ) {
    const cliente = clienteDe(tx);
    const [filas, total] = await Promise.all([
      cliente.query(
        `${SQL_COSECHA} WHERE c.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[])
          ORDER BY c.fecha DESC, c.recibida_en DESC LIMIT $3 OFFSET $4`,
        [organizacionId, fincaIds, limite, desplazamiento],
      ),
      cliente.query("SELECT count(*)::int AS n FROM cosecha WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[])", [
        organizacionId,
        fincaIds,
      ]),
    ]);
    return { filas: filas.rows.map(aCosecha), total: total.rows[0].n as number };
  }

  async opcionesRegistro(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<OpcionesRegistro> {
    const c = clienteDe(tx);
    const [fincas, lotes, bodegas, productos, unidades] = await Promise.all([
      c.query("SELECT id, nombre FROM finca WHERE organizacion_id = $1 AND id = ANY($2::uuid[]) AND activa ORDER BY nombre", [organizacionId, fincaIds]),
      c.query("SELECT id, finca_id, codigo, nombre FROM lote WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) ORDER BY codigo", [organizacionId, fincaIds]),
      c.query("SELECT id, finca_id, nombre FROM bodega WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) ORDER BY nombre", [organizacionId, fincaIds]),
      c.query("SELECT id, codigo, nombre, unidad_id FROM producto WHERE organizacion_id = $1 AND activo ORDER BY codigo", [organizacionId]),
      c.query("SELECT id, codigo, nombre FROM unidad WHERE tipo = 'masa' ORDER BY codigo"),
    ]);
    return {
      fincas: fincas.rows,
      lotes: lotes.rows.map((x) => ({ id: x.id, fincaId: x.finca_id, codigo: x.codigo, nombre: x.nombre })),
      bodegas: bodegas.rows.map((x) => ({ id: x.id, fincaId: x.finca_id, nombre: x.nombre })),
      productos: productos.rows.map((x) => ({ id: x.id, codigo: x.codigo, nombre: x.nombre, unidadId: x.unidad_id })),
      unidades: unidades.rows,
    };
  }
}
