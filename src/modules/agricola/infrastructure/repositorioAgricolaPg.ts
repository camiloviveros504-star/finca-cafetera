import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorRegla } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type {
  FilaActividad, FilaAgroquimico, FilaAplicacion, FilaEquipo, FilaInspeccion, FilaMantenimiento, FilaProyeccion, FilaRegistroAmbiental,
  FilaStockAgroquimico, RepositorioAgricola, StockParaAplicar,
} from "../domain/puertos";

const codigoError = (e: unknown) => (e as { code?: string }).code;
const id0 = async (p: Promise<{ rows: { id: string }[] }>) => (await p).rows[0]?.id ?? null;

export class RepositorioAgricolaPg implements RepositorioAgricola {
  // ── Sanidad ──
  buscarInspeccionPorClave(tx: Transaccion, o: string, c: string) {
    return id0(clienteDe(tx).query("SELECT id FROM inspeccion WHERE organizacion_id = $1 AND clave_idempotencia = $2", [o, c]));
  }
  async loteEsDeFinca(tx: Transaccion, o: string, loteId: string, fincaId: string) {
    return (await clienteDe(tx).query("SELECT 1 FROM lote WHERE id = $1 AND finca_id = $2 AND organizacion_id = $3", [loteId, fincaId, o])).rowCount === 1;
  }
  async insertarInspeccion(tx: Transaccion, i: Parameters<RepositorioAgricola["insertarInspeccion"]>[1]) {
    const r = await clienteDe(tx).query(
      `INSERT INTO inspeccion (organizacion_id, finca_id, lote_id, fecha, tipo, severidad, infestacion_pct, hallazgos, acciones, clave_idempotencia, inspector_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [i.organizacionId, i.fincaId, i.loteId ?? null, i.fecha, i.tipo, i.severidad, i.infestacionPct ?? null, i.hallazgos, i.acciones ?? null, i.clave, i.inspectorId],
    );
    return r.rows[0].id as string;
  }
  async listarInspecciones(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<FilaInspeccion[]> {
    const r = await clienteDe(tx).query(
      `SELECT i.id, i.fecha::text AS fecha, f.nombre AS finca, l.codigo AS lote, i.tipo, i.severidad, i.infestacion_pct, i.hallazgos, i.acciones, u.nombre AS inspector
         FROM inspeccion i JOIN finca f ON f.id = i.finca_id LEFT JOIN lote l ON l.id = i.lote_id JOIN usuario u ON u.id = i.inspector_id
        WHERE i.organizacion_id = $1 AND i.finca_id = ANY($2::uuid[]) ORDER BY i.fecha DESC, i.creado_en DESC LIMIT 200`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, fecha: x.fecha, fincaNombre: x.finca, loteCodigo: x.lote, tipo: x.tipo, severidad: x.severidad, infestacionPct: x.infestacion_pct, hallazgos: x.hallazgos, acciones: x.acciones, inspector: x.inspector }));
  }
  buscarAmbientalPorClave(tx: Transaccion, o: string, c: string) {
    return id0(clienteDe(tx).query("SELECT id FROM registro_ambiental WHERE organizacion_id = $1 AND clave_idempotencia = $2", [o, c]));
  }
  async insertarAmbiental(tx: Transaccion, r: Parameters<RepositorioAgricola["insertarAmbiental"]>[1]) {
    const res = await clienteDe(tx).query(
      "INSERT INTO registro_ambiental (organizacion_id, finca_id, fecha, tipo, descripcion, cantidad, unidad, clave_idempotencia, responsable_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
      [r.organizacionId, r.fincaId, r.fecha, r.tipo, r.descripcion, r.cantidad ?? null, r.unidad ?? null, r.clave, r.responsableId],
    );
    return res.rows[0].id as string;
  }
  async listarAmbientales(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<FilaRegistroAmbiental[]> {
    const r = await clienteDe(tx).query(
      `SELECT a.id, a.fecha::text AS fecha, f.nombre AS finca, a.tipo, a.descripcion, a.cantidad, a.unidad, u.nombre AS responsable
         FROM registro_ambiental a JOIN finca f ON f.id = a.finca_id JOIN usuario u ON u.id = a.responsable_id
        WHERE a.organizacion_id = $1 AND a.finca_id = ANY($2::uuid[]) ORDER BY a.fecha DESC, a.creado_en DESC LIMIT 200`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, fecha: x.fecha, fincaNombre: x.finca, tipo: x.tipo, descripcion: x.descripcion, cantidad: x.cantidad, unidad: x.unidad, responsable: x.responsable }));
  }
  async crearAgroquimico(tx: Transaccion, a: Parameters<RepositorioAgricola["crearAgroquimico"]>[1]) {
    try {
      const r = await clienteDe(tx).query("INSERT INTO agroquimico (organizacion_id, nombre, unidad, carencia_dias, tipo, gramos_por_unidad, finca_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [a.organizacionId, a.nombre, a.unidad, a.carenciaDias ?? null, a.tipo, a.gramosPorUnidad ?? null, a.fincaId ?? null]);
      return r.rows[0].id as string;
    } catch (error) {
      if (codigoError(error) === "23505") throw new ErrorRegla("Ya existe un agroquímico con ese nombre", "agroquimico_duplicado");
      throw error;
    }
  }
  async listarAgroquimicos(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<FilaAgroquimico[]> {
    // Cada finca ve sus propios insumos y los compartidos de la organización (sin finca).
    const r = await clienteDe(tx).query("SELECT id, nombre, unidad, carencia_dias, tipo, gramos_por_unidad, finca_id FROM agroquimico WHERE organizacion_id = $1 AND activo AND (finca_id IS NULL OR finca_id = ANY($2::uuid[])) ORDER BY tipo, nombre", [o, fincaIds]);
    return r.rows.map((x) => ({ id: x.id, nombre: x.nombre, unidad: x.unidad, carenciaDias: x.carencia_dias, tipo: x.tipo, gramosPorUnidad: x.gramos_por_unidad, fincaId: x.finca_id }));
  }
  async arbolesDelLote(tx: Transaccion, o: string, loteId: string) {
    const r = await clienteDe(tx).query("SELECT numero_arboles FROM lote WHERE id = $1 AND organizacion_id = $2", [loteId, o]);
    return r.rows[0] ? (r.rows[0].numero_arboles as number | null) : null;
  }
  async agroquimicoExiste(tx: Transaccion, o: string, id: string) {
    return (await clienteDe(tx).query("SELECT 1 FROM agroquimico WHERE id = $1 AND organizacion_id = $2 AND activo", [id, o])).rowCount === 1;
  }
  async acreditarStock(tx: Transaccion, s: Parameters<RepositorioAgricola["acreditarStock"]>[1]) {
    const c = clienteDe(tx);
    const r = await c.query(
      `INSERT INTO agroquimico_stock (organizacion_id, finca_id, agroquimico_id, lote_comercial, vencimiento, cantidad) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (finca_id, agroquimico_id, lote_comercial) DO UPDATE SET cantidad = agroquimico_stock.cantidad + EXCLUDED.cantidad RETURNING id`,
      [s.organizacionId, s.fincaId, s.agroquimicoId, s.loteComercial, s.vencimiento, s.cantidad],
    );
    const id = r.rows[0].id as string;
    await c.query("INSERT INTO agroquimico_movimiento (organizacion_id, stock_id, tipo, delta, creado_por, nota) VALUES ($1,$2,'entrada',$3,$4,$5)", [s.organizacionId, id, s.cantidad, s.usuarioId, s.nota ?? null]);
    return id;
  }
  async bloquearStock(tx: Transaccion, o: string, stockId: string): Promise<StockParaAplicar | null> {
    const r = await clienteDe(tx).query(
      `SELECT s.id, s.finca_id, s.agroquimico_id, s.cantidad, s.vencimiento::text AS vencimiento, a.carencia_dias, a.unidad, a.gramos_por_unidad
         FROM agroquimico_stock s JOIN agroquimico a ON a.id = s.agroquimico_id WHERE s.id = $1 AND s.organizacion_id = $2 FOR UPDATE OF s`,
      [stockId, o],
    );
    const x = r.rows[0];
    return x ? { id: x.id, fincaId: x.finca_id, agroquimicoId: x.agroquimico_id, cantidad: x.cantidad, vencimiento: x.vencimiento, carenciaDias: x.carencia_dias, unidad: x.unidad, gramosPorUnidad: x.gramos_por_unidad } : null;
  }
  async descontarStock(tx: Transaccion, stockId: string, cantidad: string) {
    await clienteDe(tx).query("UPDATE agroquimico_stock SET cantidad = cantidad - $2 WHERE id = $1", [stockId, cantidad]);
  }
  async insertarMovimientoAgroquimico(tx: Transaccion, m: Parameters<RepositorioAgricola["insertarMovimientoAgroquimico"]>[1]) {
    await clienteDe(tx).query("INSERT INTO agroquimico_movimiento (organizacion_id, stock_id, tipo, delta, origen_id, creado_por, nota) VALUES ($1,$2,$3,$4,$5,$6,$7)", [m.organizacionId, m.stockId, m.tipo, m.delta, m.origenId ?? null, m.usuarioId, m.nota ?? null]);
  }
  buscarAplicacionPorClave(tx: Transaccion, o: string, c: string) {
    return id0(clienteDe(tx).query("SELECT id FROM aplicacion_agroquimica WHERE organizacion_id = $1 AND clave_idempotencia = $2", [o, c]));
  }
  async insertarAplicacion(tx: Transaccion, a: Parameters<RepositorioAgricola["insertarAplicacion"]>[1]) {
    const r = await clienteDe(tx).query(
      `INSERT INTO aplicacion_agroquimica (organizacion_id, finca_id, lote_id, stock_id, fecha, dosis, unidad_dosis, cantidad_total, fecha_reingreso, inspeccion_id, responsable_id, clave_idempotencia, gramos_por_arbol, arboles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [a.organizacionId, a.fincaId, a.loteId, a.stockId, a.fecha, a.dosis, a.unidadDosis, a.cantidadTotal, a.fechaReingreso, a.inspeccionId ?? null, a.responsableId, a.clave, a.gramosPorArbol ?? null, a.arboles ?? null],
    );
    return r.rows[0].id as string;
  }
  async listarStock(tx: Transaccion, o: string, fincaIds: readonly string[], hoy: string): Promise<FilaStockAgroquimico[]> {
    const r = await clienteDe(tx).query(
      `SELECT s.id, s.finca_id, f.nombre AS finca, a.id AS agro_id, a.nombre, a.unidad, s.lote_comercial, s.vencimiento::text AS vencimiento, s.cantidad, a.gramos_por_unidad,
              coalesce(s.vencimiento < $3::date, false) AS vencido, coalesce(s.vencimiento >= $3::date AND s.vencimiento <= $3::date + 30, false) AS por_vencer
         FROM agroquimico_stock s JOIN agroquimico a ON a.id = s.agroquimico_id JOIN finca f ON f.id = s.finca_id
        WHERE s.organizacion_id = $1 AND a.activo AND s.finca_id = ANY($2::uuid[]) ORDER BY s.vencimiento, a.nombre`,
      [o, fincaIds, hoy],
    );
    return r.rows.map((x) => ({ id: x.id, fincaId: x.finca_id, fincaNombre: x.finca, agroquimicoId: x.agro_id, nombre: x.nombre, unidad: x.unidad, loteComercial: x.lote_comercial, vencimiento: x.vencimiento, cantidad: x.cantidad, vencido: x.vencido, porVencer: x.por_vencer, gramosPorUnidad: x.gramos_por_unidad }));
  }
  async listarAplicaciones(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<FilaAplicacion[]> {
    const r = await clienteDe(tx).query(
      `SELECT p.id, p.lote_id, p.fecha::text AS fecha, f.nombre AS finca, l.codigo AS lote, a.nombre AS agro, s.lote_comercial, p.dosis, p.unidad_dosis, p.cantidad_total,
              p.fecha_reingreso::text AS reingreso, u.nombre AS responsable, p.gramos_por_arbol, p.arboles
         FROM aplicacion_agroquimica p JOIN finca f ON f.id = p.finca_id JOIN lote l ON l.id = p.lote_id JOIN agroquimico_stock s ON s.id = p.stock_id
         JOIN agroquimico a ON a.id = s.agroquimico_id JOIN usuario u ON u.id = p.responsable_id
        WHERE p.organizacion_id = $1 AND p.finca_id = ANY($2::uuid[]) ORDER BY p.fecha DESC, p.creado_en DESC LIMIT 200`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, loteId: x.lote_id, fecha: x.fecha, fincaNombre: x.finca, loteCodigo: x.lote, agroquimico: x.agro, loteComercial: x.lote_comercial, dosis: x.dosis, unidadDosis: x.unidad_dosis, cantidadTotal: x.cantidad_total, fechaReingreso: x.reingreso, responsable: x.responsable, gramosPorArbol: x.gramos_por_arbol, arboles: x.arboles }));
  }

  // ── Planificación ──
  buscarActividadPorClave(tx: Transaccion, o: string, c: string) {
    return id0(clienteDe(tx).query("SELECT id FROM actividad_programada WHERE organizacion_id = $1 AND clave_idempotencia = $2", [o, c]));
  }
  async insertarActividad(tx: Transaccion, a: Parameters<RepositorioAgricola["insertarActividad"]>[1]) {
    const r = await clienteDe(tx).query(
      "INSERT INTO actividad_programada (organizacion_id, finca_id, lote_id, tipo, titulo, fecha_programada, clave_idempotencia, creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [a.organizacionId, a.fincaId, a.loteId ?? null, a.tipo, a.titulo, a.fecha, a.clave, a.creadoPor],
    );
    return r.rows[0].id as string;
  }
  async cerrarActividad(tx: Transaccion, v: Parameters<RepositorioAgricola["cerrarActividad"]>[1]) {
    const r = await clienteDe(tx).query(
      "UPDATE actividad_programada SET estado = $3, fecha_cierre = $4, resultado = $5 WHERE id = $1 AND organizacion_id = $2 AND estado = 'programada' RETURNING finca_id",
      [v.id, v.organizacionId, v.estado, v.fechaCierre, v.resultado ?? null],
    );
    if (r.rows[0]) return { fincaId: r.rows[0].finca_id as string };
    const existe = await clienteDe(tx).query("SELECT 1 FROM actividad_programada WHERE id = $1 AND organizacion_id = $2", [v.id, v.organizacionId]);
    if (existe.rowCount === 1) throw new ErrorRegla("La actividad ya fue cerrada", "actividad_cerrada");
    return null;
  }
  async listarActividades(tx: Transaccion, o: string, fincaIds: readonly string[], hoy: string): Promise<FilaActividad[]> {
    const r = await clienteDe(tx).query(
      `SELECT a.id, a.finca_id, f.nombre AS finca, l.codigo AS lote, a.tipo, a.titulo, a.fecha_programada::text AS fecha, a.estado, a.fecha_cierre::text AS cierre, a.resultado,
              (a.estado = 'programada' AND a.fecha_programada < $3::date) AS atrasada
         FROM actividad_programada a JOIN finca f ON f.id = a.finca_id LEFT JOIN lote l ON l.id = a.lote_id
        WHERE a.organizacion_id = $1 AND a.finca_id = ANY($2::uuid[]) ORDER BY (a.estado = 'programada') DESC, a.fecha_programada LIMIT 300`,
      [o, fincaIds, hoy],
    );
    return r.rows.map((x) => ({ id: x.id, fincaId: x.finca_id, fincaNombre: x.finca, loteCodigo: x.lote, tipo: x.tipo, titulo: x.titulo, fechaProgramada: x.fecha, estado: x.estado, fechaCierre: x.cierre, resultado: x.resultado, atrasada: x.atrasada }));
  }
  buscarProyeccionPorClave(tx: Transaccion, o: string, c: string) {
    return id0(clienteDe(tx).query("SELECT id FROM proyeccion_cosecha WHERE organizacion_id = $1 AND clave_idempotencia = $2", [o, c]));
  }
  async insertarProyeccion(tx: Transaccion, p: Parameters<RepositorioAgricola["insertarProyeccion"]>[1]) {
    const r = await clienteDe(tx).query(
      "INSERT INTO proyeccion_cosecha (organizacion_id, finca_id, lote_id, desde, hasta, cantidad_estimada_kg, nota, clave_idempotencia, creado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
      [p.organizacionId, p.fincaId, p.loteId, p.desde, p.hasta, p.estimadoKg, p.nota ?? null, p.clave, p.creadoPor],
    );
    return r.rows[0].id as string;
  }
  async listarProyecciones(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<FilaProyeccion[]> {
    const r = await clienteDe(tx).query(
      `SELECT p.id, f.nombre AS finca, l.codigo AS lote, p.desde::text AS desde, p.hasta::text AS hasta, p.cantidad_estimada_kg AS estimado, p.nota,
              coalesce((SELECT sum(c.cantidad_base) FROM cosecha c WHERE c.lote_id = p.lote_id AND c.estado = 'confirmada' AND c.fecha BETWEEN p.desde AND p.hasta), 0) AS real
         FROM proyeccion_cosecha p JOIN finca f ON f.id = p.finca_id JOIN lote l ON l.id = p.lote_id
        WHERE p.organizacion_id = $1 AND p.finca_id = ANY($2::uuid[]) ORDER BY p.desde DESC LIMIT 200`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({
      id: x.id, fincaNombre: x.finca, loteCodigo: x.lote, desde: x.desde, hasta: x.hasta, estimadoKg: x.estimado, realKg: x.real, nota: x.nota,
      cumplimientoPct: Number(x.estimado) > 0 ? (Math.round((Number(x.real) / Number(x.estimado)) * 1000) / 10).toFixed(1) : null,
    }));
  }

  // ── Maquinaria ──
  async crearEquipo(tx: Transaccion, e: Parameters<RepositorioAgricola["crearEquipo"]>[1]) {
    try {
      const r = await clienteDe(tx).query(
        "INSERT INTO equipo (organizacion_id, finca_id, tipo, codigo, nombre, intervalo_mantenimiento_dias) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [e.organizacionId, e.fincaId, e.tipo, e.codigo, e.nombre, e.intervaloDias ?? null],
      );
      return r.rows[0].id as string;
    } catch (error) {
      if (codigoError(error) === "23505") throw new ErrorRegla("Ya existe un equipo con ese código en la finca", "equipo_duplicado");
      throw error;
    }
  }
  async obtenerEquipo(tx: Transaccion, o: string, id: string) {
    const r = await clienteDe(tx).query("SELECT id, finca_id, nombre, estado FROM equipo WHERE id = $1 AND organizacion_id = $2", [id, o]);
    const x = r.rows[0];
    return x ? { id: x.id as string, fincaId: x.finca_id as string, nombre: x.nombre as string, estado: x.estado as string } : null;
  }
  buscarUsoPorClave(tx: Transaccion, o: string, c: string) {
    return id0(clienteDe(tx).query("SELECT id FROM uso_equipo WHERE organizacion_id = $1 AND clave_idempotencia = $2", [o, c]));
  }
  async insertarUso(tx: Transaccion, u: Parameters<RepositorioAgricola["insertarUso"]>[1]) {
    const r = await clienteDe(tx).query(
      "INSERT INTO uso_equipo (organizacion_id, equipo_id, fecha, horas, combustible_litros, nota, clave_idempotencia, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [u.organizacionId, u.equipoId, u.fecha, u.horas, u.combustible ?? null, u.nota ?? null, u.clave, u.registradoPor],
    );
    return r.rows[0].id as string;
  }
  buscarMantenimientoPorClave(tx: Transaccion, o: string, c: string) {
    return id0(clienteDe(tx).query("SELECT id FROM mantenimiento WHERE organizacion_id = $1 AND clave_idempotencia = $2", [o, c]));
  }
  async insertarMantenimiento(tx: Transaccion, m: Parameters<RepositorioAgricola["insertarMantenimiento"]>[1]) {
    const r = await clienteDe(tx).query(
      "INSERT INTO mantenimiento (organizacion_id, equipo_id, fecha, tipo, descripcion, costo, proximo_en, clave_idempotencia, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
      [m.organizacionId, m.equipoId, m.fecha, m.tipo, m.descripcion, m.costo, m.proximoEn ?? null, m.clave, m.registradoPor],
    );
    return r.rows[0].id as string;
  }
  async vincularGasto(tx: Transaccion, mantenimientoId: string, gastoId: string) {
    await clienteDe(tx).query("UPDATE mantenimiento SET gasto_id = $2 WHERE id = $1", [mantenimientoId, gastoId]);
  }
  async listarEquipos(tx: Transaccion, o: string, fincaIds: readonly string[], hoy: string): Promise<FilaEquipo[]> {
    const r = await clienteDe(tx).query(
      `SELECT e.id, e.finca_id, f.nombre AS finca, e.tipo, e.codigo, e.nombre, e.estado,
              coalesce((SELECT sum(u.horas) FROM uso_equipo u WHERE u.equipo_id = e.id), 0) AS horas,
              coalesce((SELECT sum(u.combustible_litros) FROM uso_equipo u WHERE u.equipo_id = e.id), 0) AS combustible,
              coalesce((SELECT sum(m.costo) FROM mantenimiento m WHERE m.equipo_id = e.id), 0) AS costo,
              (SELECT max(m.fecha)::text FROM mantenimiento m WHERE m.equipo_id = e.id) AS ultimo,
              coalesce((SELECT max(m.proximo_en) FROM mantenimiento m WHERE m.equipo_id = e.id AND m.fecha = (SELECT max(m2.fecha) FROM mantenimiento m2 WHERE m2.equipo_id = e.id)),
                       (SELECT max(m.fecha) + e.intervalo_mantenimiento_dias FROM mantenimiento m WHERE m.equipo_id = e.id AND e.intervalo_mantenimiento_dias IS NOT NULL))::text AS proximo
         FROM equipo e JOIN finca f ON f.id = e.finca_id
        WHERE e.organizacion_id = $1 AND e.finca_id = ANY($2::uuid[]) ORDER BY f.nombre, e.codigo`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({
      id: x.id, fincaId: x.finca_id, fincaNombre: x.finca, tipo: x.tipo, codigo: x.codigo, nombre: x.nombre, estado: x.estado, horasUso: x.horas, combustibleLitros: x.combustible,
      costoMantenimiento: x.costo, ultimoMantenimiento: x.ultimo, proximoMantenimiento: x.proximo, mantenimientoVencido: x.proximo !== null && x.proximo < hoy,
    }));
  }
  async listarMantenimientos(tx: Transaccion, o: string, fincaIds: readonly string[]): Promise<FilaMantenimiento[]> {
    const r = await clienteDe(tx).query(
      `SELECT m.id, m.fecha::text AS fecha, e.nombre AS equipo, m.tipo, m.descripcion, m.costo, m.proximo_en::text AS proximo, (m.gasto_id IS NOT NULL) AS con_gasto
         FROM mantenimiento m JOIN equipo e ON e.id = m.equipo_id WHERE m.organizacion_id = $1 AND e.finca_id = ANY($2::uuid[]) ORDER BY m.fecha DESC, m.creado_en DESC LIMIT 200`,
      [o, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, fecha: x.fecha, equipo: x.equipo, tipo: x.tipo, descripcion: x.descripcion, costo: x.costo, proximoEn: x.proximo, conGasto: x.con_gasto }));
  }
}
