import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consultarSaldos,
  consultarTrazabilidadVenta,
  ErrorExistenciasInsuficientes,
  ErrorProhibido,
  registrarCosecha,
  registrarVenta,
} from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno();
});
afterAll(async () => {
  await e.cerrar();
});

const saldo = async (loteId: string, producto: string) =>
  Number((await e.pool.query("SELECT cantidad FROM saldo_inventario WHERE lote_id = $1 AND producto_id = $2", [loteId, producto])).rows[0].cantidad);

describe("venta (D1, QA-02, QA-05, QA-07)", () => {
  it("el responsable comercial registra una venta: descuenta, guarda lote, precio y auditoría", async () => {
    const ctx = await e.contexto("comercial@demo.local");
    const r = await registrarVenta(e.servicios.comercial, ctx, {
      fincaId: e.ids.finca1,
      clienteId: e.ids.clienteA,
      claveIdempotencia: randomUUID(),
      items: [{ productoId: e.ids.PSE, cantidad: "10", loteId: e.ids.lote1_01 }],
    });
    expect(r.repetida).toBe(false);
    expect(r.venta.detalles[0].loteId).toBe(e.ids.lote1_01);
    expect(r.venta.detalles[0].precioUnitario).toBe("14000.00"); // precio DEMO de la tarifa vigente
    expect(r.venta.total).toBe("140000.00");
    expect(await saldo(e.ids.lote1_01, e.ids.PSE)).toBe(50);
    const aud = await e.pool.query("SELECT resultado FROM auditoria WHERE accion = 'venta.crear' AND entidad_id = $1", [r.venta.id]);
    expect(aud.rows[0].resultado).toBe("ok");
    const mov = await e.pool.query("SELECT delta, origen_tipo FROM movimiento_inventario WHERE origen_id = $1", [r.venta.id]);
    expect(mov.rows).toEqual([{ delta: "-10.000", origen_tipo: "venta" }]);
  });

  it("rechaza una venta mayor que las existencias, sin dejar rastros de inventario", async () => {
    const ctx = await e.contexto("comercial@demo.local");
    const antes = await saldo(e.ids.lote1_02, e.ids.PSE);
    await expect(
      registrarVenta(e.servicios.comercial, ctx, {
        fincaId: e.ids.finca1,
        clienteId: e.ids.clienteA,
        claveIdempotencia: randomUUID(),
        items: [{ productoId: e.ids.PSE, cantidad: "41", loteId: e.ids.lote1_02 }],
      }),
    ).rejects.toThrow(ErrorExistenciasInsuficientes);
    expect(await saldo(e.ids.lote1_02, e.ids.PSE)).toBe(antes);
  });

  it("idempotencia: el mismo reintento devuelve la venta original y no duplica (QA-02)", async () => {
    const ctx = await e.contexto("comercial@demo.local");
    const entrada = {
      fincaId: e.ids.finca1,
      clienteId: e.ids.clienteA,
      claveIdempotencia: randomUUID(),
      items: [{ productoId: e.ids.PSE, cantidad: "1", loteId: e.ids.lote1_02 }],
    };
    const antes = await saldo(e.ids.lote1_02, e.ids.PSE);
    const primera = await registrarVenta(e.servicios.comercial, ctx, entrada);
    const segunda = await registrarVenta(e.servicios.comercial, ctx, entrada);
    expect(segunda.repetida).toBe(true);
    expect(segunda.venta.id).toBe(primera.venta.id);
    expect(await saldo(e.ids.lote1_02, e.ids.PSE)).toBe(antes - 1);
  });

  it("QA-05: el encargado de producción no puede crear ventas (403) y queda auditado", async () => {
    const ctx = await e.contexto("produccion@demo.local");
    await expect(
      registrarVenta(e.servicios.comercial, ctx, {
        fincaId: e.ids.finca1,
        clienteId: e.ids.clienteA,
        claveIdempotencia: randomUUID(),
        items: [{ productoId: e.ids.PSE, cantidad: "1" }],
      }),
    ).rejects.toThrow(ErrorProhibido);
    const aud = await e.pool.query(
      "SELECT resultado, despues FROM auditoria WHERE accion = 'venta.crear' AND resultado = 'denegado' AND usuario_id = $1",
      [ctx.usuarioId],
    );
    expect(aud.rowCount).toBeGreaterThanOrEqual(1);
    expect(aud.rows[0].despues.permisoRequerido).toBe("venta:crear");
  });

  it("QA-07: un usuario de la finca 2 no puede vender ni consultar la finca 1", async () => {
    const ctx = await e.contexto("comercial2@demo.local");
    await expect(
      registrarVenta(e.servicios.comercial, ctx, {
        fincaId: e.ids.finca1,
        clienteId: e.ids.clienteA,
        claveIdempotencia: randomUUID(),
        items: [{ productoId: e.ids.PSE, cantidad: "1" }],
      }),
    ).rejects.toThrow(ErrorProhibido);
    const filas = await consultarSaldos(e.servicios.inventario, ctx);
    expect(filas.every((f) => f.fincaId === e.ids.finca2)).toBe(true);
    await expect(consultarSaldos(e.servicios.inventario, ctx, e.ids.finca1)).rejects.toThrow(ErrorProhibido);
  });
});

describe("trazabilidad (D2, QA-03, QA-04)", () => {
  it("de una venta se llega a su lote y a las cosechas de ese lote", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await registrarCosecha(e.servicios.produccion, prod, {
      fincaId: e.ids.finca1,
      loteId: e.ids.lote1_01,
      bodegaId: e.ids.bodega1,
      productoId: e.ids.CER,
      unidadId: e.ids.arroba,
      fecha: "2026-11-01",
      cantidad: "8",
      claveIdempotencia: randomUUID(),
    });
    const com = await e.contexto("comercial@demo.local");
    const venta = await registrarVenta(e.servicios.comercial, com, {
      fincaId: e.ids.finca1,
      clienteId: e.ids.clienteA,
      claveIdempotencia: randomUUID(),
      items: [{ productoId: e.ids.PSE, cantidad: "2", loteId: e.ids.lote1_01 }],
    });
    const traza = await consultarTrazabilidadVenta(e.servicios.trazabilidad, com, venta.venta.id);
    expect(traza.lineas[0].loteCodigo).toBe("L-01");
    expect(traza.lineas[0].cosechas.length).toBeGreaterThanOrEqual(1);
    expect(traza.lineas[0].cosechas[0].cantidad).toBe("8.000");
  });

  it("convierte la unidad de la cosecha con la equivalencia configurable (8 arrobas = 100 kg)", async () => {
    const r = await e.pool.query("SELECT cantidad_base, factor_aplicado FROM cosecha WHERE cantidad = 8");
    expect(r.rows[0].cantidad_base).toBe("100.000");
    expect(r.rows[0].factor_aplicado).toBe("12.500000");
  });

  it("QA-04: rechaza una cosecha con un lote de otra finca (aplicación)", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await expect(
      registrarCosecha(e.servicios.produccion, prod, {
        fincaId: e.ids.finca1,
        loteId: e.ids.lote2_01,
        bodegaId: e.ids.bodega1,
        productoId: e.ids.CER,
        unidadId: e.ids.kg,
        fecha: "2026-11-01",
        cantidad: "5",
        claveIdempotencia: randomUUID(),
      }),
    ).rejects.toThrow(/lote/i);
  });

  it("la cosecha es idempotente por UUID del cliente (cola sin conexión)", async () => {
    const prod = await e.contexto("produccion@demo.local");
    const entrada = {
      fincaId: e.ids.finca1,
      loteId: e.ids.lote1_02,
      bodegaId: e.ids.bodega1,
      productoId: e.ids.CER,
      unidadId: e.ids.kg,
      fecha: "2026-11-02",
      cantidad: "20",
      claveIdempotencia: randomUUID(),
    };
    const a = await registrarCosecha(e.servicios.produccion, prod, entrada);
    const b = await registrarCosecha(e.servicios.produccion, prod, entrada);
    expect(b.repetida).toBe(true);
    expect(b.cosecha.id).toBe(a.cosecha.id);
    const n = await e.pool.query("SELECT count(*)::int AS n FROM cosecha WHERE clave_idempotencia = $1", [entrada.claveIdempotencia]);
    expect(n.rows[0].n).toBe(1);
  });
});
