import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { avanzarCafe, consultarEstadoCafe, ErrorExistenciasInsuficientes, ErrorRegla, ErrorValidacion, registrarRecoleccion, registrarVenta } from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
const hoy = fechaColombia();
const manana = fechaColombia(new Date(Date.now() + 36 * 3600 * 1000));

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 6 });
});
afterAll(async () => {
  await e.cerrar();
});

/** Kilos de un estado del café en un lote, leídos de la consulta que usa la bodega. */
async function kg(estado: string, loteId = e.ids.lote1_02) {
  const dueno = await e.contexto("propietario@demo.local");
  const r = await consultarEstadoCafe(e.servicios.beneficio, dueno);
  return Number(r.porLote.filter((f) => f.loteId === loteId && f.estado === estado).reduce((a, f) => a + Number(f.kg), 0));
}

describe("recolección", () => {
  it("no acepta fechas futuras", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    await expect(registrarRecoleccion(e.servicios, dueno, { fincaId: e.ids.finca1, loteId: e.ids.lote1_02, fecha: manana, claveIdempotencia: randomUUID(), kgTotal: "10", lineas: [] })).rejects.toThrow(ErrorValidacion);
  });

  it("por trabajador suma los kilos sin trabajador (el dueño o un amigo que ayudó) y siempre entra como café rojo", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const trabajadorId = (await e.pool.query("SELECT id FROM trabajador WHERE numero_documento = '1000000001'")).rows[0].id;
    const antes = await kg("CER");
    // Aunque se envíe otro tipo de café, la recolección siempre es café rojo.
    const r = await registrarRecoleccion(e.servicios, dueno, {
      fincaId: e.ids.finca1, loteId: e.ids.lote1_02, productoId: e.ids.PSE, fecha: hoy, claveIdempotencia: randomUUID(),
      kgSinTrabajador: "15", lineas: [{ trabajadorId, kg: "85", precioKg: "700" }],
    });
    expect(r).toMatchObject({ kg: "100.000", kgSinTrabajador: "15.000", trabajadores: 1 });
    expect(await kg("CER")).toBe(antes + 100);
  });
});

describe("camino del café en la bodega", () => {
  it("rojo → en lavado → húmedo → en secado → seco, con los kilos de cada paso y sin pasar de lo que hay", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const base = { fincaId: e.ids.finca1, loteId: e.ids.lote1_02, fecha: hoy };
    const rojo = await kg("CER");
    await avanzarCafe(e.servicios.beneficio, dueno, { ...base, paso: "despulpado", kgEntrada: "100", kgSalida: "60", claveIdempotencia: randomUUID() });
    expect(await kg("CER")).toBe(rojo - 100);
    expect(await kg("PLV")).toBe(60);

    await avanzarCafe(e.servicios.beneficio, dueno, { ...base, paso: "lavado", kgEntrada: "60", kgSalida: "58", claveIdempotencia: randomUUID() });
    // Poner a secar no cambia el peso: no se pide cuánto salió.
    const secando = await avanzarCafe(e.servicios.beneficio, dueno, { ...base, paso: "inicio_secado", kgEntrada: "58", claveIdempotencia: randomUUID() });
    expect(secando.kgSalida).toBe("58");
    expect(await kg("PHU")).toBe(0);
    expect(await kg("PSC")).toBe(58);

    await avanzarCafe(e.servicios.beneficio, dueno, { ...base, paso: "secado", kgEntrada: "58", kgSalida: "25", claveIdempotencia: randomUUID() });
    expect(await kg("PSC")).toBe(0);
    const estado = await consultarEstadoCafe(e.servicios.beneficio, dueno);
    expect(Number(estado.estados.find((x) => x.codigo === "PSE")!.kg)).toBeGreaterThanOrEqual(25);

    // No se procesa café que no hay, ni sale más de lo que entra, ni se registra con fecha futura.
    await expect(avanzarCafe(e.servicios.beneficio, dueno, { ...base, paso: "despulpado", kgEntrada: "99999", kgSalida: "1", claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorExistenciasInsuficientes);
    await expect(avanzarCafe(e.servicios.beneficio, dueno, { ...base, paso: "trilla", kgEntrada: "5", kgSalida: "6", claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorRegla);
    await expect(avanzarCafe(e.servicios.beneficio, dueno, { ...base, fecha: manana, paso: "trilla", kgEntrada: "5", kgSalida: "4", claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorValidacion);
    // El trabajador no avanza café.
    await expect(avanzarCafe(e.servicios.beneficio, await e.contexto("trabajador@demo.local"), { ...base, paso: "trilla", kgEntrada: "1", kgSalida: "1", claveIdempotencia: randomUUID() })).rejects.toThrow();
  });

  it("el café en lavado o en secado no se vende; el seco se vende en arrobas y se descuenta en kilos", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const base = { fincaId: e.ids.finca1, loteId: e.ids.lote1_02, fecha: hoy };
    await registrarRecoleccion(e.servicios, dueno, { ...base, claveIdempotencia: randomUUID(), kgTotal: "10", lineas: [] });
    await avanzarCafe(e.servicios.beneficio, dueno, { ...base, paso: "despulpado", kgEntrada: "10", kgSalida: "6", claveIdempotencia: randomUUID() });
    const enLavado = (await e.pool.query("SELECT id FROM producto WHERE codigo = 'PLV'")).rows[0].id;
    await expect(registrarVenta(e.servicios.comercial, dueno, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), items: [{ productoId: enLavado, cantidad: "1", precioKg: "1000" }] })).rejects.toThrow(ErrorRegla);

    const factor = Number((await e.pool.query("SELECT c.factor FROM conversion_unidad c JOIN unidad u ON u.id = c.unidad_origen_id WHERE u.codigo = 'arroba' AND c.finca_id IS NULL LIMIT 1")).rows[0].factor);
    const seco = await kg("PSE", e.ids.lote1_01) + await kg("PSE", e.ids.lote1_02);
    const r = await registrarVenta(e.servicios.comercial, dueno, {
      fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(),
      items: [{ productoId: e.ids.PSE, cantidad: "2", unidad: "arroba", precioKg: "150000" }],
    });
    expect(Number(r.venta.total)).toBeCloseTo(300000, 0);
    expect(await kg("PSE", e.ids.lote1_01) + await kg("PSE", e.ids.lote1_02)).toBeCloseTo(seco - 2 * factor, 3);
  });
});
