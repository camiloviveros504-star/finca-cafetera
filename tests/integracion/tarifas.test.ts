import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearVersionTarifa, ErrorProhibido, listarTarifas, registrarVenta } from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
let tarifaPse: string;
beforeAll(async () => {
  e = await crearEntorno();
  tarifaPse = (await e.pool.query("SELECT id FROM tarifa WHERE producto_id = $1", [e.ids.PSE])).rows[0].id;
});
afterAll(async () => {
  await e.cerrar();
});

const hoy = fechaColombia();
const manana = fechaColombia(new Date(Date.now() + 36 * 3600 * 1000));

describe("QA-12 · cambio de tarifa sin tocar el histórico", () => {
  it("una venta guarda el precio y la versión aplicados; una nueva tarifa no los altera", async () => {
    const com = await e.contexto("comercial@demo.local");
    const admin = await e.contexto("propietario.ambas@demo.local");
    const v1 = await registrarVenta(e.servicios.comercial, com, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), items: [{ productoId: e.ids.PSE, cantidad: "2", loteId: e.ids.lote1_01 }] });
    expect(v1.venta.detalles[0].precioUnitario).toBe("14000.00");

    const inicio = Date.now();
    const nueva = await crearVersionTarifa(e.servicios.tarifas, admin, { tarifaId: tarifaPse, valor: "15500", desde: hoy });
    expect(Date.now() - inicio).toBeLessThan(2 * 60 * 1000); // meta QA-12: ≤ 2 min, sin desplegar código
    expect(nueva.version).toBe(2);

    const v2 = await registrarVenta(e.servicios.comercial, com, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), items: [{ productoId: e.ids.PSE, cantidad: "2", loteId: e.ids.lote1_01 }] });
    expect(v2.venta.detalles[0].precioUnitario).toBe("15500.00");

    const historica = await e.pool.query("SELECT precio_unitario, subtotal, tarifa_version_id FROM venta_detalle WHERE venta_id = $1", [v1.venta.id]);
    expect(historica.rows[0].precio_unitario).toBe("14000.00");
    expect(historica.rows[0].subtotal).toBe("28000.00");
    expect(historica.rows[0].tarifa_version_id).toBe(v1.venta.detalles[0].tarifaVersionId);
    expect(v2.venta.detalles[0].tarifaVersionId).not.toBe(v1.venta.detalles[0].tarifaVersionId);
  });

  it("no se permite una vigencia en el pasado ni solapada", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    await expect(crearVersionTarifa(e.servicios.tarifas, admin, { tarifaId: tarifaPse, valor: "1", desde: "2020-01-01" })).rejects.toThrow(/pasado/);
    await crearVersionTarifa(e.servicios.tarifas, admin, { tarifaId: tarifaPse, valor: "16000", desde: manana });
    await expect(crearVersionTarifa(e.servicios.tarifas, admin, { tarifaId: tarifaPse, valor: "1", desde: hoy })).rejects.toThrow(/después|solapa/);
    const filas = await listarTarifas(e.servicios.tarifas, admin);
    const t = filas.find((f) => f.tarifaId === tarifaPse);
    expect(t?.valorVigente).toBe("15500.00");
    expect(t?.versiones).toBe(3);
  });

  it("solo quien tiene tarifa:modificar puede cambiarla (QA-05); queda auditado", async () => {
    for (const correo of ["comercial@demo.local", "produccion@demo.local"]) {
      const ctx = await e.contexto(correo);
      await expect(crearVersionTarifa(e.servicios.tarifas, ctx, { tarifaId: tarifaPse, valor: "1", desde: manana })).rejects.toThrow(ErrorProhibido);
    }
    const n = await e.pool.query("SELECT count(*)::int AS n FROM auditoria WHERE accion = 'tarifa.modificar' AND resultado = 'denegado'");
    expect(n.rows[0].n).toBe(2);
  });
});
