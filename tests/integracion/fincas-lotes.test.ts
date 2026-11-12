import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearFinca, crearLote, ErrorProhibido, listarFincasYLotes, registrarEventoLote } from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno({ poolMax: 5 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("fincas y lotes", () => {
  it("el propietario crea su finca (con su bodega) y sus lotes; el administrador ni crea fincas ni opera lotes", async () => {
    const admin = await e.contexto("admin@demo.local");
    await expect(crearFinca(e.servicios.fincasLotes, admin, { nombre: "Finca Del Admin" })).rejects.toThrow(ErrorProhibido);
    const { id } = await crearFinca(e.servicios.fincasLotes, await e.contexto("propietario@demo.local"), { nombre: "Finca Nueva", ubicacion: "Vereda X", areaHa: "5.5" });
    const b = await e.pool.query("SELECT count(*)::int AS n FROM bodega WHERE finca_id = $1", [id]);
    expect(b.rows[0].n).toBe(1);
    await expect(crearLote(e.servicios.fincasLotes, await e.contexto("admin@demo.local"), { fincaId: id, codigo: "L-98", nombre: "No debe" })).rejects.toThrow(ErrorProhibido);
    const dueno = await e.contexto("propietario@demo.local"); // contexto nuevo: recarga sus fincas
    await crearLote(e.servicios.fincasLotes, dueno, { fincaId: id, codigo: "L-99", nombre: "Lote nuevo", areaHa: "1.2", numeroArboles: "3000" });
    const datos = await listarFincasYLotes(e.servicios.fincasLotes, dueno);
    expect(datos.fincas.map((f) => f.nombre)).toContain("Finca Nueva");
    expect(datos.lotes.some((l) => l.codigo === "L-99")).toBe(true);
  });

  it("no permite códigos de lote repetidos en la misma finca", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await expect(crearLote(e.servicios.fincasLotes, prod, { fincaId: e.ids.finca1, codigo: "L-01", nombre: "Repetido" })).rejects.toThrow(/Ya existe/);
  });

  it("el encargado de producción administra lotes pero no crea fincas; no toca otra finca", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await crearLote(e.servicios.fincasLotes, prod, { fincaId: e.ids.finca1, codigo: "L-50", nombre: "Lote del encargado" });
    await expect(crearFinca(e.servicios.fincasLotes, prod, { nombre: "Finca no permitida" })).rejects.toThrow(ErrorProhibido);
    await expect(crearLote(e.servicios.fincasLotes, prod, { fincaId: e.ids.finca2, codigo: "L-51", nombre: "Ajeno" })).rejects.toThrow(ErrorProhibido);
  });

  it("la variedad solo se guarda si el lote está sembrado: al sembrarlo se registra y al tumbarlo se borra", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const variedad = async (id: string) => (await e.pool.query("SELECT variedad FROM lote WHERE id = $1", [id])).rows[0].variedad;
    const { id } = await crearLote(e.servicios.fincasLotes, dueno, { fincaId: e.ids.finca1, codigo: "L-70", nombre: "Lote por sembrar", areaHa: "1", variedad: "Castillo" });
    expect(await variedad(id)).toBeNull();
    await registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "siembra", fecha: fechaColombia(), arboles: "5000", variedad: "Cenicafé 1" });
    expect(await variedad(id)).toBe("Cenicafé 1");
    await registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "tumba", fecha: fechaColombia() });
    expect(await variedad(id)).toBeNull();
    const sembrado = await crearLote(e.servicios.fincasLotes, dueno, { fincaId: e.ids.finca1, codigo: "L-71", nombre: "Lote sembrado", areaHa: "1", variedad: "Castillo", fechaSiembra: "2024-03-01", numeroArboles: "5000" });
    expect(await variedad(sembrado.id)).toBe("Castillo");
  });
});
