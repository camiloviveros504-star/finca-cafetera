import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consultarTrazabilidadVenta,
  ErrorExistenciasInsuficientes,
  ErrorProhibido,
  registrarAjuste,
  registrarVenta,
  reversarMovimiento,
  trasladar,
  transformar,
} from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
let bodegaB: string;
beforeAll(async () => {
  e = await crearEntorno();
  const r = await e.pool.query(
    "INSERT INTO bodega (organizacion_id, finca_id, nombre) SELECT organizacion_id, id, 'Bodega B DEMO' FROM finca WHERE id = $1 RETURNING id",
    [e.ids.finca1],
  );
  bodegaB = r.rows[0].id;
});
afterAll(async () => {
  await e.cerrar();
});

const saldo = async (bodega: string, producto: string, lote: string) => {
  const r = await e.pool.query("SELECT cantidad FROM saldo_inventario WHERE bodega_id = $1 AND producto_id = $2 AND lote_id = $3", [bodega, producto, lote]);
  return r.rows[0] ? Number(r.rows[0].cantidad) : 0;
};
const ubic = () => ({ fincaId: e.ids.finca1, bodegaId: e.ids.bodega1, productoId: e.ids.PSE, loteId: e.ids.lote1_01 });

describe("ajustes y pérdidas", () => {
  it("una pérdida resta y queda auditada con su motivo", async () => {
    const ctx = await e.contexto("produccion@demo.local");
    const antes = await saldo(e.ids.bodega1, e.ids.PSE, e.ids.lote1_01);
    const r = await registrarAjuste(e.servicios.operaciones, ctx, { ...ubic(), tipo: "perdida", cantidad: "2.5", motivo: "Grano brocado", claveIdempotencia: randomUUID() });
    expect(r.repetida).toBe(false);
    expect(await saldo(e.ids.bodega1, e.ids.PSE, e.ids.lote1_01)).toBe(antes - 2.5);
    const m = await e.pool.query("SELECT tipo, delta, nota FROM movimiento_inventario WHERE id = $1", [r.movimientoId]);
    expect(m.rows[0]).toEqual({ tipo: "perdida", delta: "-2.500", nota: "Grano brocado" });
  });

  it("no permite restar más de lo que hay y es idempotente", async () => {
    const ctx = await e.contexto("produccion@demo.local");
    await expect(
      registrarAjuste(e.servicios.operaciones, ctx, { ...ubic(), tipo: "perdida", cantidad: "9999", motivo: "Prueba", claveIdempotencia: randomUUID() }),
    ).rejects.toThrow(ErrorExistenciasInsuficientes);
    const clave = randomUUID();
    const a = await registrarAjuste(e.servicios.operaciones, ctx, { ...ubic(), tipo: "ajuste", sentido: "aumento", cantidad: "1", motivo: "Conteo físico", claveIdempotencia: clave });
    const b = await registrarAjuste(e.servicios.operaciones, ctx, { ...ubic(), tipo: "ajuste", sentido: "aumento", cantidad: "1", motivo: "Conteo físico", claveIdempotencia: clave });
    expect(b.repetida).toBe(true);
    expect(b.movimientoId).toBe(a.movimientoId);
  });

  it("el responsable comercial no puede ajustar inventario (403)", async () => {
    const ctx = await e.contexto("comercial@demo.local");
    await expect(
      registrarAjuste(e.servicios.operaciones, ctx, { ...ubic(), tipo: "perdida", cantidad: "1", motivo: "No debería", claveIdempotencia: randomUUID() }),
    ).rejects.toThrow(ErrorProhibido);
  });

  it("30 pérdidas simultáneas de 5 kg sobre 100 kg: exactamente 20 prosperan y el saldo no es negativo", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    await e.pool.query("UPDATE saldo_inventario SET cantidad = 100 WHERE bodega_id = $1 AND producto_id = $2 AND lote_id = $3", [e.ids.bodega1, e.ids.PSE, e.ids.lote1_02]);
    const u = { fincaId: e.ids.finca1, bodegaId: e.ids.bodega1, productoId: e.ids.PSE, loteId: e.ids.lote1_02 };
    const r = await Promise.allSettled(
      Array.from({ length: 30 }, () => registrarAjuste(e.servicios.operaciones, admin, { ...u, tipo: "perdida", cantidad: "5", motivo: "Prueba concurrente", claveIdempotencia: randomUUID() })),
    );
    expect(r.filter((x) => x.status === "fulfilled").length).toBe(20);
    expect(r.filter((x) => x.status === "rejected" && x.reason instanceof ErrorExistenciasInsuficientes).length).toBe(10);
    expect(await saldo(e.ids.bodega1, e.ids.PSE, e.ids.lote1_02)).toBe(0);
  });
});

describe("traslados, transformaciones y reversos", () => {
  it("un traslado mueve existencias entre bodegas sin cambiar el total", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    const total = async () => (await saldo(e.ids.bodega1, e.ids.EXC, e.ids.lote1_01)) + (await saldo(bodegaB, e.ids.EXC, e.ids.lote1_01));
    const antes = await total();
    await trasladar(e.servicios.operaciones, admin, { fincaId: e.ids.finca1, bodegaOrigenId: e.ids.bodega1, bodegaDestinoId: bodegaB, productoId: e.ids.EXC, loteId: e.ids.lote1_01, cantidad: "10", claveIdempotencia: randomUUID() });
    expect(await total()).toBe(antes);
    expect(await saldo(bodegaB, e.ids.EXC, e.ids.lote1_01)).toBe(10);
    await expect(
      trasladar(e.servicios.operaciones, admin, { fincaId: e.ids.finca1, bodegaOrigenId: bodegaB, bodegaDestinoId: e.ids.bodega1, productoId: e.ids.EXC, loteId: e.ids.lote1_01, cantidad: "11", claveIdempotencia: randomUUID() }),
    ).rejects.toThrow(ErrorExistenciasInsuficientes);
  });

  it("la transformación conserva el lote y aparece en la trazabilidad de la venta", async () => {
    const prod = await e.contexto("produccion@demo.local");
    const clave = randomUUID();
    const entrada = {
      fincaId: e.ids.finca1,
      bodegaId: e.ids.bodega1,
      tipo: "pergamino_seco_a_excelso",
      fecha: "2026-11-05",
      claveIdempotencia: clave,
      lineas: [{ loteId: e.ids.lote1_01, productoEntradaId: e.ids.PSE, productoSalidaId: e.ids.EXC, cantidadEntrada: "20", cantidadSalida: "18.5" }],
    };
    const antesPse = await saldo(e.ids.bodega1, e.ids.PSE, e.ids.lote1_01);
    const antesExc = await saldo(e.ids.bodega1, e.ids.EXC, e.ids.lote1_01);
    const a = await transformar(e.servicios.operaciones, prod, entrada);
    const b = await transformar(e.servicios.operaciones, prod, entrada);
    expect(b.repetida).toBe(true);
    expect(b.transformacionId).toBe(a.transformacionId);
    expect(await saldo(e.ids.bodega1, e.ids.PSE, e.ids.lote1_01)).toBe(antesPse - 20);
    expect(await saldo(e.ids.bodega1, e.ids.EXC, e.ids.lote1_01)).toBe(antesExc + 18.5);
    const linea = await e.pool.query("SELECT cantidad_perdida FROM transformacion_linea WHERE transformacion_id = $1", [a.transformacionId]);
    expect(linea.rows[0].cantidad_perdida).toBe("1.500");

    const com = await e.contexto("comercial@demo.local");
    const venta = await registrarVenta(e.servicios.comercial, com, {
      fincaId: e.ids.finca1,
      clienteId: e.ids.clienteA,
      claveIdempotencia: randomUUID(),
      items: [{ productoId: e.ids.EXC, cantidad: "3", loteId: e.ids.lote1_01 }],
    });
    const traza = await consultarTrazabilidadVenta(e.servicios.trazabilidad, com, venta.venta.id);
    expect(traza.lineas[0].transformaciones[0].productoEntrada).toContain("Pergamino");
    expect(traza.lineas[0].transformaciones[0].productoSalida).toContain("Excelso");
  });

  it("rechaza una transformación que produce más de lo que consume", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await expect(
      transformar(e.servicios.operaciones, prod, {
        fincaId: e.ids.finca1,
        bodegaId: e.ids.bodega1,
        tipo: "pergamino_seco_a_excelso",
        fecha: "2026-11-05",
        claveIdempotencia: randomUUID(),
        lineas: [{ loteId: e.ids.lote1_01, productoEntradaId: e.ids.PSE, productoSalidaId: e.ids.EXC, cantidadEntrada: "5", cantidadSalida: "6" }],
      }),
    ).rejects.toThrow(/superar/);
  });

  it("un reverso corrige un ajuste; no se puede reversar dos veces ni dejar el saldo negativo", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    const u = { fincaId: e.ids.finca1, bodegaId: e.ids.bodega1, productoId: e.ids.EXC, loteId: e.ids.lote1_01 };
    const aj = await registrarAjuste(e.servicios.operaciones, admin, { ...u, tipo: "ajuste", sentido: "aumento", cantidad: "4", motivo: "Error de conteo", claveIdempotencia: randomUUID() });
    const antes = await saldo(e.ids.bodega1, e.ids.EXC, e.ids.lote1_01);
    await reversarMovimiento(e.servicios.operaciones, admin, { movimientoId: aj.movimientoId, motivo: "Se contó dos veces" });
    expect(await saldo(e.ids.bodega1, e.ids.EXC, e.ids.lote1_01)).toBe(antes - 4);
    await expect(reversarMovimiento(e.servicios.operaciones, admin, { movimientoId: aj.movimientoId, motivo: "Otra vez" })).rejects.toThrow(/ya fue reversado/);

    const aj2 = await registrarAjuste(e.servicios.operaciones, admin, { ...u, tipo: "ajuste", sentido: "aumento", cantidad: "1", motivo: "Conteo", claveIdempotencia: randomUUID() });
    await e.pool.query("UPDATE saldo_inventario SET cantidad = 0 WHERE bodega_id = $1 AND producto_id = $2 AND lote_id = $3", [u.bodegaId, u.productoId, u.loteId]);
    await expect(reversarMovimiento(e.servicios.operaciones, admin, { movimientoId: aj2.movimientoId, motivo: "Reverso" })).rejects.toThrow(/negativas/);
  });

  it("el encargado de producción no puede reversar (no tiene el permiso)", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await expect(reversarMovimiento(e.servicios.operaciones, prod, { movimientoId: randomUUID(), motivo: "Sin permiso" })).rejects.toThrow(ErrorProhibido);
  });

  it("las ventas no se pueden reversar como movimiento suelto", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    const m = await e.pool.query("SELECT id FROM movimiento_inventario WHERE origen_tipo = 'venta' LIMIT 1");
    await expect(reversarMovimiento(e.servicios.operaciones, admin, { movimientoId: m.rows[0].id, motivo: "Intento" })).rejects.toThrow(/no se puede reversar/i);
  });
});
