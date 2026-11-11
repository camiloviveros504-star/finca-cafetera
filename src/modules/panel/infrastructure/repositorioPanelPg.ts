import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { RepositorioPanel } from "../domain/puertos";

/** Inicio del mes en curso en la hora de Colombia (las fechas del negocio son locales). */
const INICIO_MES = "(date_trunc('month', now() AT TIME ZONE 'America/Bogota'))";

export class RepositorioPanelPg implements RepositorioPanel {
  async existencias(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT p.nombre AS producto, sum(s.cantidad) AS kg
         FROM saldo_inventario s JOIN producto p ON p.id = s.producto_id
        WHERE s.organizacion_id = $1 AND s.finca_id = ANY($2::uuid[]) AND s.cantidad > 0
        GROUP BY p.nombre ORDER BY p.nombre`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({ producto: x.producto as string, kg: x.kg as string }));
  }

  async ventasMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT count(*)::int AS n, coalesce(sum(total), 0) AS total FROM venta
        WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) AND estado = 'confirmada' AND fecha >= ${INICIO_MES} AT TIME ZONE 'America/Bogota'`,
      [organizacionId, fincaIds],
    );
    return { cantidad: r.rows[0].n as number, total: r.rows[0].total as string };
  }

  async recoleccionPorLote(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT f.nombre AS finca, l.codigo || ' · ' || l.nombre AS lote,
              CASE WHEN l.estado_productivo = 'sin_sembrar' THEN 'Sin sembrar' WHEN l.fecha_ultima_zoca IS NOT NULL THEN 'Zoca' ELSE 'Café nuevo' END AS estado,
              coalesce((SELECT sum(c.cantidad_base) FROM cosecha c WHERE c.lote_id = l.id AND c.estado = 'confirmada' AND c.fecha >= date_trunc('year', current_date)), 0) AS kg
         FROM lote l JOIN finca f ON f.id = l.finca_id
        WHERE l.organizacion_id = $1 AND l.finca_id = ANY($2::uuid[]) ORDER BY f.nombre, l.codigo`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({ finca: x.finca as string, lote: x.lote as string, estado: x.estado as string, kg: x.kg as string }));
  }

  async recoleccionPorMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT to_char(m, 'YYYY-MM') AS mes,
              coalesce((SELECT sum(c.cantidad_base) FROM cosecha c WHERE c.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[]) AND c.estado = 'confirmada'
                         AND c.fecha >= m AND c.fecha < m + interval '1 month'), 0) AS kg
         FROM generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') AS m ORDER BY m`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({ mes: x.mes as string, kg: x.kg as string }));
  }

  async billeteraMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT
         coalesce((SELECT sum(p.monto) FROM pago_cliente p JOIN venta v ON v.id = p.venta_id
                    WHERE v.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[]) AND p.fecha >= ${INICIO_MES} AT TIME ZONE 'America/Bogota'), 0) AS entradas,
         coalesce((SELECT sum(g.monto) FROM gasto g WHERE g.organizacion_id = $1 AND g.finca_id = ANY($2::uuid[]) AND g.fecha >= ${INICIO_MES}::date), 0) AS gastos,
         coalesce((SELECT sum(g.monto) FROM gasto g WHERE g.organizacion_id = $1 AND g.finca_id = ANY($2::uuid[]) AND g.tipo = 'flete' AND g.fecha >= ${INICIO_MES}::date), 0) AS fletes,
         coalesce((SELECT sum(pp.monto) FROM pago_proveedor pp JOIN compra c ON c.id = pp.compra_id
                    WHERE c.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[]) AND pp.fecha >= ${INICIO_MES}::date), 0) AS proveedores,
         coalesce((SELECT sum(pt.monto) FROM pago_trabajador pt JOIN liquidacion l ON l.id = pt.liquidacion_id
                    WHERE pt.organizacion_id = $1 AND pt.fecha >= ${INICIO_MES}::date
                      AND EXISTS (SELECT 1 FROM liquidacion_detalle d JOIN registro_trabajo w ON w.id = d.registro_trabajo_id WHERE d.liquidacion_id = l.id AND w.finca_id = ANY($2::uuid[]))), 0) AS trabajadores`,
      [organizacionId, fincaIds],
    );
    const x = r.rows[0];
    // Suma exacta en el motor de base de datos para no perder centavos con números de punto flotante.
    const t = await clienteDe(tx).query("SELECT ($1::numeric + $2::numeric + $3::numeric)::text AS salidas, ($4::numeric - $1::numeric - $2::numeric - $3::numeric)::text AS saldo", [x.gastos, x.proveedores, x.trabajadores, x.entradas]);
    return { entradas: x.entradas as string, salidas: t.rows[0].salidas as string, saldo: t.rows[0].saldo as string, fletes: x.fletes as string };
  }

  async porCobrar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT count(*)::int AS n, coalesce(sum(saldo), 0) AS total FROM (
         SELECT v.total - coalesce((SELECT sum(p.monto) FROM pago_cliente p WHERE p.venta_id = v.id), 0) AS saldo
           FROM venta v WHERE v.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[]) AND v.estado = 'confirmada') x WHERE saldo > 0`,
      [organizacionId, fincaIds],
    );
    return { total: r.rows[0].total as string, ventas: r.rows[0].n as number };
  }

  async porPagar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const c = clienteDe(tx);
    const prov = await c.query("SELECT coalesce(sum(total - pagado), 0) AS t FROM compra WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) AND estado = 'recibida'", [organizacionId, fincaIds]);
    const trab = await c.query(
      `SELECT coalesce((SELECT sum(w.valor_calculado) FROM registro_trabajo w WHERE w.organizacion_id = $1 AND w.finca_id = ANY($2::uuid[]) AND w.estado = 'validado'), 0)
            + coalesce((SELECT sum(l.neto - l.pagado) FROM liquidacion l WHERE l.organizacion_id = $1 AND EXISTS (SELECT 1 FROM vinculacion v WHERE v.trabajador_id = l.trabajador_id AND v.finca_id = ANY($2::uuid[]))), 0) AS t`,
      [organizacionId, fincaIds],
    );
    return { proveedores: prov.rows[0].t as string, trabajadores: trab.rows[0].t as string };
  }

  async insumosPorVencer(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      "SELECT count(*)::int AS n FROM agroquimico_stock s JOIN agroquimico a ON a.id = s.agroquimico_id WHERE s.organizacion_id = $1 AND a.activo AND s.finca_id = ANY($2::uuid[]) AND s.cantidad > 0 AND s.vencimiento IS NOT NULL AND s.vencimiento <= current_date + 30",
      [organizacionId, fincaIds],
    );
    return r.rows[0].n as number;
  }

  async plagasActivas(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      "SELECT count(DISTINCT lote_id)::int AS lotes, count(*)::int AS casos, count(*) FILTER (WHERE severidad = 'alta')::int AS altas FROM caso_sanitario WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) AND estado <> 'controlado'",
      [organizacionId, fincaIds],
    );
    return { lotes: r.rows[0].lotes as number, casos: r.rows[0].casos as number, altas: r.rows[0].altas as number };
  }

  async plataforma(tx: Transaccion, organizacionId: string) {
    const c = clienteDe(tx);
    const f = await c.query("SELECT count(*)::int AS fincas, coalesce(sum(area_ha), 0) AS ha FROM finca WHERE organizacion_id = $1 AND activa", [organizacionId]);
    const l = await c.query("SELECT count(*)::int AS n FROM lote WHERE organizacion_id = $1", [organizacionId]);
    const u = await c.query("SELECT count(*)::int AS n FROM usuario WHERE organizacion_id = $1 AND activo", [organizacionId]);
    const k = await c.query(
      `SELECT coalesce(sum(c.cantidad_base) FILTER (WHERE c.fecha >= date_trunc('year', current_date)), 0) AS anio,
              coalesce(sum(s.cantidad), 0) AS seco
         FROM (SELECT 1) t
         LEFT JOIN cosecha c ON c.organizacion_id = $1 AND c.estado = 'confirmada'
         LEFT JOIN LATERAL (SELECT sum(sa.cantidad) AS cantidad FROM saldo_inventario sa JOIN producto p ON p.id = sa.producto_id WHERE sa.organizacion_id = $1 AND p.codigo = 'PSE') s ON true`,
      [organizacionId],
    );
    return { fincas: f.rows[0].fincas as number, lotes: l.rows[0].n as number, hectareas: f.rows[0].ha as string, usuarios: u.rows[0].n as number, kgAnio: k.rows[0].anio as string, kgSeco: k.rows[0].seco as string };
  }

  async cosechasMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]) {
    const r = await clienteDe(tx).query(
      `SELECT count(*)::int AS n, coalesce(sum(cantidad_base), 0) AS kg FROM cosecha
        WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[]) AND estado = 'confirmada' AND fecha >= ${INICIO_MES}::date`,
      [organizacionId, fincaIds],
    );
    return { cantidad: r.rows[0].n as number, kg: r.rows[0].kg as string };
  }
}
