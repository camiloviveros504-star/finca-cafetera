import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearFinca, crearLote, ErrorProhibido, listarFincasYLotes } from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno({ poolMax: 5 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("fincas y lotes", () => {
  it("el administrador crea una finca (queda con acceso y con bodega) y un lote", async () => {
    const admin = await e.contexto("admin@demo.local");
    const { id } = await crearFinca(e.servicios.fincasLotes, admin, { nombre: "Finca Nueva DEMO", ubicacion: "Vereda X", areaHa: "5.5" });
    const b = await e.pool.query("SELECT count(*)::int AS n FROM bodega WHERE finca_id = $1", [id]);
    expect(b.rows[0].n).toBe(1);
    const admin2 = await e.contexto("admin@demo.local"); // contexto nuevo: recarga las fincas asignadas
    await crearLote(e.servicios.fincasLotes, admin2, { fincaId: id, codigo: "L-99", nombre: "Lote nuevo", areaHa: "1.2", numeroArboles: "3000" });
    const datos = await listarFincasYLotes(e.servicios.fincasLotes, admin2);
    expect(datos.fincas.map((f) => f.nombre)).toContain("Finca Nueva DEMO");
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
});
