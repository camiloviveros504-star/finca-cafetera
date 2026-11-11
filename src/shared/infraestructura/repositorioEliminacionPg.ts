import type { RepositorioEliminacion, TipoEliminable } from "../aplicacion/eliminar";
import type { Transaccion } from "../dominio/contexto";
import { clienteDe } from "./baseDatos";

interface Configuracion {
  tabla: string;
  /** Consulta que devuelve las fincas del registro (columna `f`). */
  fincas: string;
  /** Pasos previos que borran datos dependientes sin valor propio. */
  antes?: string[];
  /** Cómo se archiva cuando tiene historial. */
  archivar: string;
}

// Solo estas tablas pueden tocarse: el tipo llega validado como enumeración, nunca como texto libre.
const CONFIG: Record<TipoEliminable, Configuracion> = {
  cliente: { tabla: "cliente", fincas: "SELECT finca_id AS f FROM cliente WHERE id = $1 AND organizacion_id = $2 AND finca_id IS NOT NULL", archivar: "activo = false" },
  proveedor: { tabla: "proveedor", fincas: "SELECT finca_id AS f FROM proveedor WHERE id = $1 AND organizacion_id = $2 AND finca_id IS NOT NULL", archivar: "activo = false" },
  insumo: { tabla: "agroquimico", fincas: "SELECT finca_id AS f FROM agroquimico WHERE id = $1 AND organizacion_id = $2 AND finca_id IS NOT NULL", antes: ["DELETE FROM agroquimico_stock WHERE agroquimico_id = $1 AND organizacion_id = $2 AND cantidad = 0 AND NOT EXISTS (SELECT 1 FROM agroquimico_movimiento m WHERE m.stock_id = agroquimico_stock.id)"], archivar: "activo = false" },
  trabajador: { tabla: "trabajador", fincas: "SELECT finca_id AS f FROM vinculacion WHERE trabajador_id = $1 AND organizacion_id = $2", antes: ["DELETE FROM vinculacion WHERE trabajador_id = $1 AND organizacion_id = $2"], archivar: "activo = false" },
  equipo: { tabla: "equipo", fincas: "SELECT finca_id AS f FROM equipo WHERE id = $1 AND organizacion_id = $2", archivar: "estado = 'baja'" },
  actividad: { tabla: "actividad_programada", fincas: "SELECT finca_id AS f FROM actividad_programada WHERE id = $1 AND organizacion_id = $2", archivar: "estado = 'cancelada'" },
};

const EXISTE: Record<TipoEliminable, string> = {
  cliente: "SELECT 1 FROM cliente WHERE id = $1 AND organizacion_id = $2",
  proveedor: "SELECT 1 FROM proveedor WHERE id = $1 AND organizacion_id = $2",
  insumo: "SELECT 1 FROM agroquimico WHERE id = $1 AND organizacion_id = $2",
  trabajador: "SELECT 1 FROM trabajador WHERE id = $1 AND organizacion_id = $2",
  equipo: "SELECT 1 FROM equipo WHERE id = $1 AND organizacion_id = $2",
  actividad: "SELECT 1 FROM actividad_programada WHERE id = $1 AND organizacion_id = $2",
};

export class RepositorioEliminacionPg implements RepositorioEliminacion {
  async fincasDe(tx: Transaccion, organizacionId: string, tipo: TipoEliminable, id: string) {
    const c = clienteDe(tx);
    if ((await c.query(EXISTE[tipo], [id, organizacionId])).rowCount === 0) return null;
    const r = await c.query(CONFIG[tipo].fincas, [id, organizacionId]);
    return r.rows.map((x) => x.f as string);
  }

  async eliminarOArchivar(tx: Transaccion, organizacionId: string, tipo: TipoEliminable, id: string): Promise<"eliminado" | "archivado"> {
    const c = clienteDe(tx);
    const cfg = CONFIG[tipo];
    await c.query("SAVEPOINT eliminar_registro");
    try {
      for (const sql of cfg.antes ?? []) await c.query(sql, [id, organizacionId]);
      const r = await c.query(`DELETE FROM ${cfg.tabla} WHERE id = $1 AND organizacion_id = $2`, [id, organizacionId]);
      await c.query("RELEASE SAVEPOINT eliminar_registro");
      return r.rowCount === 1 ? "eliminado" : "archivado";
    } catch (error) {
      await c.query("ROLLBACK TO SAVEPOINT eliminar_registro");
      const codigo = (error as { code?: string }).code;
      // 23503: tiene historial que lo referencia. 55000 u otros triggers de inmutabilidad: también se conserva.
      if (codigo !== "23503" && codigo !== "P0001" && codigo !== "55000") throw error;
      await c.query(`UPDATE ${cfg.tabla} SET ${cfg.archivar} WHERE id = $1 AND organizacion_id = $2`, [id, organizacionId]);
      return "archivado";
    }
  }
}
