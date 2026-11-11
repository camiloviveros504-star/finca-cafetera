import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consultarTrazabilidadVenta } from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";
import { guardarResultado, percentil } from "../ayudas/resultados";

/**
 * QA-03 · Trazabilidad con volumen: 100.000 movimientos y 10.000 cosechas (por defecto).
 * Se generan con SQL en lote sobre una base temporal y se mide la consulta real de trazabilidad.
 */
const COSECHAS = Number(process.env.VOLUMEN_COSECHAS ?? 10_000);
const VENTAS = Number(process.env.VOLUMEN_VENTAS ?? 90_000); // 1 movimiento de salida por venta → 100.000 en total
const CONSULTAS = Number(process.env.VOLUMEN_CONSULTAS ?? 300);
const LOTES = 100;

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
}, 300_000);
afterAll(async () => {
  await e.cerrar();
});

describe.skipIf(process.env.PRUEBAS_VOLUMEN !== "si")("QA-03 · consulta de trazabilidad con grandes volúmenes", () => {
  it(`${COSECHAS} cosechas + ${VENTAS + COSECHAS} movimientos: 100 % de las ventas con lote y p95 ≤ 2 s`, async () => {
    const q = (sql: string, params: unknown[] = []) => e.pool.query(sql, params);
    const admin = (await q("SELECT id, organizacion_id FROM usuario WHERE correo = 'admin@demo.local'")).rows[0];
    const t0 = Date.now();

    await q(
      `INSERT INTO lote (organizacion_id, finca_id, codigo, nombre)
       SELECT $1, $2, 'V-' || g, 'Lote de volumen ' || g FROM generate_series(1, ${LOTES}) g`,
      [admin.organizacion_id, e.ids.finca1],
    );
    const lotes = (await q("SELECT id FROM lote WHERE codigo LIKE 'V-%' ORDER BY codigo")).rows.map((x) => x.id as string);

    // Cosechas con su movimiento de entrada (origen = cosecha), repartidas entre los lotes y los últimos 2 años.
    await q(
      `WITH s AS (SELECT gen_random_uuid() AS cid, gen_random_uuid() AS mid, g, ($4::uuid[])[1 + (g % ${LOTES})] AS lote FROM generate_series(1, ${COSECHAS}) g),
       c AS (
         INSERT INTO cosecha (id, organizacion_id, finca_id, lote_id, producto_id, bodega_id, fecha, cantidad, unidad_id, cantidad_base, factor_aplicado, clave_idempotencia, capturada_en, registrado_por)
         SELECT cid, $1, $2, lote, $3, $5, current_date - (g % 700), 50, $6, 50, 1, gen_random_uuid(), now(), $7 FROM s RETURNING id
       )
       INSERT INTO movimiento_inventario (id, organizacion_id, finca_id, bodega_id, producto_id, lote_id, tipo, delta, origen_tipo, origen_id, creado_por, creado_en)
       SELECT mid, $1, $2, $5, $3, lote, 'entrada', 50, 'cosecha', cid, $7, now() - (g % 700) * interval '1 day' FROM s`,
      [admin.organizacion_id, e.ids.finca1, e.ids.CER, lotes, e.ids.bodega1, e.ids.kg, admin.id],
    );

    // Transformaciones (cereza → pergamino seco) sobre una parte de los lotes, para que la cadena tenga etapas.
    await q(
      `WITH s AS (SELECT gen_random_uuid() AS tid, g, ($4::uuid[])[1 + (g % ${LOTES})] AS lote FROM generate_series(1, 5000) g),
       t AS (INSERT INTO transformacion (id, organizacion_id, finca_id, bodega_id, tipo, fecha, creado_por) SELECT tid, $1, $2, $5, 'Volumen: cereza a pergamino', current_date - (g % 600), $7 FROM s RETURNING id)
       INSERT INTO transformacion_linea (transformacion_id, lote_id, finca_id, producto_entrada_id, producto_salida_id, cantidad_entrada, cantidad_salida, cantidad_perdida)
       SELECT tid, lote, $2, $3, $6, 100, 20, 80 FROM s`,
      [admin.organizacion_id, e.ids.finca1, e.ids.CER, lotes, e.ids.bodega1, e.ids.PSE, admin.id],
    );

    // Ventas de pergamino con su detalle y su movimiento de salida, en lotes repartidos.
    await q(
      `WITH s AS (SELECT gen_random_uuid() AS vid, gen_random_uuid() AS mid, g, ($4::uuid[])[1 + (g % ${LOTES})] AS lote FROM generate_series(1, ${VENTAS}) g),
       v AS (
         INSERT INTO venta (id, organizacion_id, finca_id, cliente_id, fecha, total, clave_idempotencia, creado_por)
         SELECT vid, $1, $2, $5, now() - (g % 365) * interval '1 day', 14000, 'vol-' || g, $6 FROM s RETURNING id
       ),
       m AS (
         INSERT INTO movimiento_inventario (id, organizacion_id, finca_id, bodega_id, producto_id, lote_id, tipo, delta, origen_tipo, origen_id, creado_por)
         SELECT mid, $1, $2, $7, $3, lote, 'salida', -1, 'venta', vid, $6 FROM s RETURNING id
       )
       INSERT INTO venta_detalle (venta_id, producto_id, lote_id, finca_id, bodega_id, cantidad, precio_unitario, subtotal, movimiento_id)
       SELECT vid, $3, lote, $2, $7, 1, 14000, 14000, mid FROM s`,
      [admin.organizacion_id, e.ids.finca1, e.ids.PSE, lotes, e.ids.clienteA, admin.id, e.ids.bodega1],
    );
    await q("ANALYZE");
    const cargaMs = Date.now() - t0;

    const conteos = (await q("SELECT (SELECT count(*)::int FROM movimiento_inventario) AS movimientos, (SELECT count(*)::int FROM cosecha) AS cosechas, (SELECT count(*)::int FROM venta) AS ventas")).rows[0];
    expect(conteos.cosechas).toBeGreaterThanOrEqual(COSECHAS);
    expect(conteos.movimientos).toBeGreaterThanOrEqual(COSECHAS + VENTAS);

    // 100 % de las ventas con lote de origen: ninguna venta sin detalle y ningún detalle sin lote.
    const sinLote = (await q("SELECT count(*)::int AS n FROM venta v WHERE NOT EXISTS (SELECT 1 FROM venta_detalle d WHERE d.venta_id = v.id AND d.lote_id IS NOT NULL)")).rows[0].n;
    expect(sinLote).toBe(0);

    const muestra = (await q("SELECT id FROM venta WHERE clave_idempotencia LIKE 'vol-%' ORDER BY random() LIMIT $1", [CONSULTAS])).rows.map((x) => x.id as string);
    const auditor = await e.contexto("auditor@demo.local");
    const tiempos: number[] = [];
    let conCosechas = 0;
    for (const id of muestra) {
      const t = performance.now();
      const traza = await consultarTrazabilidadVenta(e.servicios.trazabilidad, auditor, id);
      tiempos.push(performance.now() - t);
      if (traza.lineas.every((l) => l.cosechas.length > 0)) conCosechas += 1;
    }
    const p95 = percentil(tiempos, 95);
    console.log(`QA-03: ${conteos.movimientos} movimientos, ${conteos.cosechas} cosechas, ${conteos.ventas} ventas; ${muestra.length} consultas: p50 ${percentil(tiempos, 50).toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, máx ${Math.max(...tiempos).toFixed(0)} ms (carga de datos ${(cargaMs / 1000).toFixed(0)} s)`);
    guardarResultado("qa-03", {
      movimientos: conteos.movimientos, cosechas: conteos.cosechas, ventas: conteos.ventas, consultas: muestra.length,
      ventasSinLote: sinLote, consultasConCosechas: conCosechas, p50Ms: Math.round(percentil(tiempos, 50)), p95Ms: Math.round(p95), maxMs: Math.round(Math.max(...tiempos)),
      cargaDatosSegundos: Math.round(cargaMs / 1000), comando: "vitest run tests/rendimiento",
    });
    expect(p95).toBeLessThanOrEqual(2000);
  }, 900_000);
});
