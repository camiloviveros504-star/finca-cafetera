import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorExistenciasInsuficientes, registrarVenta } from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

const RONDAS = Number(process.env.RONDAS_CONCURRENCIA ?? 20);
let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno({ poolMax: 30 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("QA-01 · ventas simultáneas sobre el mismo saldo (D1)", () => {
  it(`50 solicitudes de 50 kg sobre 60 kg: se confirma una y el saldo nunca es negativo (${RONDAS} rondas)`, async () => {
    const ctx = await e.contexto("comercial@demo.local");
    let maxMs = 0;
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      // Se repone el lote a 60 kg con un ajuste directo de prueba (los movimientos de prueba no se borran).
      await e.pool.query("UPDATE saldo_inventario SET cantidad = 60 WHERE lote_id = $1 AND producto_id = $2", [e.ids.lote1_01, e.ids.PSE]);
      const inicio = Date.now();
      const resultados = await Promise.allSettled(
        Array.from({ length: 50 }, () =>
          registrarVenta(e.servicios.comercial, ctx, {
            fincaId: e.ids.finca1,
            clienteId: e.ids.clienteA,
            claveIdempotencia: randomUUID(),
            items: [{ productoId: e.ids.PSE, cantidad: "50", loteId: e.ids.lote1_01 }],
          }),
        ),
      );
      maxMs = Math.max(maxMs, Date.now() - inicio);
      const ok = resultados.filter((r) => r.status === "fulfilled").length;
      const rechazos = resultados.filter(
        (r) => r.status === "rejected" && r.reason instanceof ErrorExistenciasInsuficientes,
      ).length;
      const otros = resultados.filter(
        (r) => r.status === "rejected" && !(r.reason instanceof ErrorExistenciasInsuficientes),
      );
      expect(otros.map((o) => (o as PromiseRejectedResult).reason?.message)).toEqual([]);
      expect(ok).toBe(1);
      expect(rechazos).toBe(49);
      const saldo = await e.pool.query("SELECT cantidad FROM saldo_inventario WHERE lote_id = $1 AND producto_id = $2", [e.ids.lote1_01, e.ids.PSE]);
      expect(Number(saldo.rows[0].cantidad)).toBe(10);
    }
    const negativos = await e.pool.query("SELECT count(*)::int AS n FROM saldo_inventario WHERE cantidad < 0");
    expect(negativos.rows[0].n).toBe(0);
    console.log(`QA-01: ${RONDAS} rondas × 50 solicitudes, 0 saldos negativos; ronda más lenta ${maxMs} ms`);
  });

  it("20 reintentos concurrentes con la MISMA clave generan una sola venta (QA-02)", async () => {
    const ctx = await e.contexto("comercial@demo.local");
    const clave = randomUUID();
    const antes = Number((await e.pool.query("SELECT cantidad FROM saldo_inventario WHERE lote_id = $1 AND producto_id = $2", [e.ids.lote1_02, e.ids.PSE])).rows[0].cantidad);
    const resultados = await Promise.all(
      Array.from({ length: 20 }, () =>
        registrarVenta(e.servicios.comercial, ctx, {
          fincaId: e.ids.finca1,
          clienteId: e.ids.clienteA,
          claveIdempotencia: clave,
          items: [{ productoId: e.ids.PSE, cantidad: "5", loteId: e.ids.lote1_02 }],
        }),
      ),
    );
    expect(new Set(resultados.map((r) => r.venta.id)).size).toBe(1);
    expect(resultados.filter((r) => !r.repetida).length).toBe(1);
    const despues = Number((await e.pool.query("SELECT cantidad FROM saldo_inventario WHERE lote_id = $1 AND producto_id = $2", [e.ids.lote1_02, e.ids.PSE])).rows[0].cantidad);
    expect(despues).toBe(antes - 5);
  });

  it("ventas sobre lotes distintos en orden distinto no se bloquean entre sí (sin deadlock)", async () => {
    const ctx = await e.contexto("comercial@demo.local");
    await e.pool.query("UPDATE saldo_inventario SET cantidad = 1000 WHERE producto_id = ANY($1::uuid[]) AND finca_id = $2", [[e.ids.PSE, e.ids.EXC], e.ids.finca1]);
    const resultados = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        registrarVenta(e.servicios.comercial, ctx, {
          fincaId: e.ids.finca1,
          clienteId: e.ids.clienteA,
          claveIdempotencia: randomUUID(),
          items:
            i % 2 === 0
              ? [{ productoId: e.ids.PSE, cantidad: "1" }, { productoId: e.ids.EXC, cantidad: "1" }]
              : [{ productoId: e.ids.EXC, cantidad: "1" }, { productoId: e.ids.PSE, cantidad: "1" }],
        }),
      ),
    );
    expect(resultados.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason?.message)).toEqual([]);
  });
});
