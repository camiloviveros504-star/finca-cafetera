import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cerrarActividad,
  crearAgroquimico,
  crearEquipo,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  listarActividades,
  listarAgroquimicos,
  listarEquipos,
  listarInspecciones,
  listarProyecciones,
  obtenerResumenFinanciero,
  programarActividad,
  registrarAmbiental,
  registrarAplicacion,
  registrarCosecha,
  registrarEntradaAgroquimico,
  registrarInspeccion,
  registrarMantenimiento,
  registrarProyeccion,
  registrarUsoEquipo,
} from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
const hoy = fechaColombia();
const k = () => randomUUID();

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("sanidad e inspecciones", () => {
  it("registra inspecciones idempotentes con lote validado, y las lista", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    const clave = k();
    const base = { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, fecha: hoy, tipo: "broca", severidad: "media", infestacionPct: "4.5", hallazgos: "Cerezas brocadas en la parte baja del lote", claveIdempotencia: clave };
    const a = await registrarInspeccion(e.servicios.agricola, sup, base);
    expect(await registrarInspeccion(e.servicios.agricola, sup, base)).toMatchObject({ id: a.id, repetida: true });
    await expect(registrarInspeccion(e.servicios.agricola, sup, { ...base, claveIdempotencia: k(), loteId: e.ids.lote2_01 })).rejects.toThrow(ErrorRegla);
    await expect(registrarInspeccion(e.servicios.agricola, sup, { ...base, claveIdempotencia: k(), infestacionPct: "140" })).rejects.toThrow(ErrorValidacion);
    await expect(registrarInspeccion(e.servicios.agricola, sup, { ...base, claveIdempotencia: k(), fecha: "2099-01-01" })).rejects.toThrow(ErrorValidacion);
    expect((await listarInspecciones(e.servicios.agricola, sup)).map((x) => x.tipo)).toContain("broca");
  });

  it("registros ambientales; el comercial no ve sanidad y el auditor solo consulta", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    await registrarAmbiental(e.servicios.agricola, sup, { fincaId: e.ids.finca1, fecha: hoy, tipo: "envases", descripcion: "Envases de agroquímicos con triple lavado", cantidad: "12", unidad: "envases", claveIdempotencia: k() });
    const com = await e.contexto("comercial@demo.local");
    await expect(listarInspecciones(e.servicios.agricola, com)).rejects.toThrow(ErrorProhibido);
    const aud = await e.contexto("auditor@demo.local");
    await expect(listarInspecciones(e.servicios.agricola, aud)).resolves.toBeDefined();
    await expect(registrarAmbiental(e.servicios.agricola, aud, { fincaId: e.ids.finca1, fecha: hoy, tipo: "agua", descripcion: "No permitido al auditor", claveIdempotencia: k() })).rejects.toThrow(ErrorProhibido);
  });
});

describe("agroquímicos: existencias, vencimiento y aplicaciones", () => {
  let agroId = "";
  let stockVigente = "";
  let stockVencido = "";

  it("el responsable de bodega registra entradas por lote comercial con vencimiento", async () => {
    const bod = await e.contexto("bodega@demo.local");
    ({ id: agroId } = await crearAgroquimico(e.servicios.agricola, bod, { nombre: "Fungicida DEMO", unidad: "litro", carenciaDias: 15 }));
    await expect(crearAgroquimico(e.servicios.agricola, bod, { nombre: "Fungicida DEMO", unidad: "litro" })).rejects.toThrow(/Ya existe/);
    ({ id: stockVigente } = await registrarEntradaAgroquimico(e.servicios.agricola, bod, { fincaId: e.ids.finca1, agroquimicoId: agroId, loteComercial: "LOTE-A", vencimiento: "2030-01-01", cantidad: "10" }));
    ({ id: stockVencido } = await registrarEntradaAgroquimico(e.servicios.agricola, bod, { fincaId: e.ids.finca1, agroquimicoId: agroId, loteComercial: "LOTE-VIEJO", vencimiento: "2020-01-01", cantidad: "5" }));
    const datos = await listarAgroquimicos(e.servicios.agricola, bod);
    expect(datos.stock.find((s) => s.id === stockVencido)?.vencido).toBe(true);
    expect(datos.stock.find((s) => s.id === stockVigente)?.vencido).toBe(false);
  });

  it("aplica con dosis y responsable, calcula la fecha de reingreso con la carencia del producto y descuenta stock", async () => {
    const enc = await e.contexto("produccion@demo.local");
    const r = await registrarAplicacion(e.servicios.agricola, enc, { stockId: stockVigente, loteId: e.ids.lote1_01, fecha: "2026-11-10", dosis: "2", unidadDosis: "litro/ha", cantidadTotal: "4", claveIdempotencia: k() });
    expect(r.fechaReingreso).toBe("2026-11-25");
    const s = await e.pool.query("SELECT cantidad FROM agroquimico_stock WHERE id = $1", [stockVigente]);
    expect(s.rows[0].cantidad).toBe("6.000");
    const m = await e.pool.query("SELECT count(*)::int AS n FROM agroquimico_movimiento WHERE stock_id = $1 AND tipo = 'aplicacion'", [stockVigente]);
    expect(m.rows[0].n).toBe(1);
    await expect(e.pool.query("DELETE FROM agroquimico_movimiento")).rejects.toThrow();
  });

  it("no aplica producto vencido ni más de lo disponible, y las aplicaciones simultáneas no dejan stock negativo", async () => {
    const enc = await e.contexto("produccion@demo.local");
    await expect(registrarAplicacion(e.servicios.agricola, enc, { stockId: stockVencido, loteId: e.ids.lote1_01, fecha: hoy, dosis: "1", unidadDosis: "litro/ha", cantidadTotal: "1", claveIdempotencia: k() })).rejects.toThrow(/vencido/);
    await expect(registrarAplicacion(e.servicios.agricola, enc, { stockId: stockVigente, loteId: e.ids.lote1_01, fecha: hoy, dosis: "1", unidadDosis: "litro/ha", cantidadTotal: "999", claveIdempotencia: k() })).rejects.toThrow(/insuficientes/);
    // Quedan 6 L: 10 aplicaciones simultáneas de 1,5 L → solo 4 caben (6 / 1,5).
    const r = await Promise.allSettled(Array.from({ length: 10 }, () => registrarAplicacion(e.servicios.agricola, enc, { stockId: stockVigente, loteId: e.ids.lote1_01, fecha: hoy, dosis: "1", unidadDosis: "litro/ha", cantidadTotal: "1.5", claveIdempotencia: k() })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(4);
    const s = await e.pool.query("SELECT cantidad FROM agroquimico_stock WHERE id = $1", [stockVigente]);
    expect(s.rows[0].cantidad).toBe("0.000");
  });

  it("otra finca no puede aplicar sobre esta existencia", async () => {
    const com2 = await e.contexto("propietario.ambas@demo.local");
    void com2;
    const prod = await e.contexto("produccion@demo.local"); // solo finca 1
    const bod = await e.contexto("propietario.ambas@demo.local");
    const { id } = await registrarEntradaAgroquimico(e.servicios.agricola, bod, { fincaId: e.ids.finca2, agroquimicoId: agroId, loteComercial: "LOTE-F2", vencimiento: "2030-01-01", cantidad: "3" });
    await expect(registrarAplicacion(e.servicios.agricola, prod, { stockId: id, loteId: e.ids.lote2_01, fecha: hoy, dosis: "1", unidadDosis: "litro/ha", cantidadTotal: "1", claveIdempotencia: k() })).rejects.toThrow(ErrorNoEncontrado);
  });
});

describe("planificación agrícola", () => {
  it("programa actividades, las cierra una sola vez y marca las atrasadas", async () => {
    const enc = await e.contexto("produccion@demo.local");
    const { id } = await programarActividad(e.servicios.agricola, enc, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, tipo: "fertilizacion", titulo: "Fertilización de mitad de año DEMO", fecha: "2026-01-15", claveIdempotencia: k() });
    await programarActividad(e.servicios.agricola, enc, { fincaId: e.ids.finca1, tipo: "floracion", titulo: "Seguimiento de floración DEMO", fecha: "2099-03-01", claveIdempotencia: k() });
    const lista = await listarActividades(e.servicios.agricola, enc);
    expect(lista.find((a) => a.id === id)?.atrasada).toBe(true);
    expect(lista.find((a) => a.tipo === "floracion")?.atrasada).toBe(false);
    await cerrarActividad(e.servicios.agricola, enc, { actividadId: id, estado: "completada", resultado: "Se aplicó según el plan" });
    await expect(cerrarActividad(e.servicios.agricola, enc, { actividadId: id, estado: "cancelada" })).rejects.toThrow(/ya fue cerrada/);
    expect((await listarActividades(e.servicios.agricola, enc)).find((a) => a.id === id)).toMatchObject({ estado: "completada", atrasada: false });
  });

  it("la proyección de cosecha se contrasta con lo cosechado realmente en el período", async () => {
    const enc = await e.contexto("produccion@demo.local");
    await registrarCosecha(e.servicios.produccion, enc, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, bodegaId: e.ids.bodega1, productoId: e.ids.CER, unidadId: e.ids.kg, fecha: "2026-11-03", cantidad: "80", claveIdempotencia: randomUUID() });
    await registrarProyeccion(e.servicios.agricola, enc, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, desde: "2026-11-01", hasta: "2026-11-30", estimadoKg: "200", claveIdempotencia: k() });
    const p = (await listarProyecciones(e.servicios.agricola, enc))[0];
    expect(p).toMatchObject({ estimadoKg: "200.000", realKg: "80.000", cumplimientoPct: "40.0" });
    await expect(registrarProyeccion(e.servicios.agricola, enc, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, desde: "2026-11-30", hasta: "2026-11-01", estimadoKg: "1", claveIdempotencia: k() })).rejects.toThrow(ErrorValidacion);
  });

  it("el trabajador recolector no accede a la planificación", async () => {
    const rec = await e.contexto("recolector@demo.local");
    await expect(listarActividades(e.servicios.agricola, rec)).rejects.toThrow(ErrorProhibido);
  });
});

describe("maquinaria y herramientas", () => {
  let equipoId = "";
  it("crea equipos, registra uso y mantenimiento; el costo pasa a finanzas como gasto", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    ({ id: equipoId } = await crearEquipo(e.servicios.agricola, admin, { fincaId: e.ids.finca1, tipo: "maquinaria", codigo: "DESP-01", nombre: "Despulpadora DEMO", intervaloDias: 90 }));
    await expect(crearEquipo(e.servicios.agricola, admin, { fincaId: e.ids.finca1, tipo: "maquinaria", codigo: "DESP-01", nombre: "Repetida" })).rejects.toThrow(/Ya existe/);
    const sup = await e.contexto("supervisor@demo.local");
    const claveUso = k();
    await registrarUsoEquipo(e.servicios.agricola, sup, { equipoId, fecha: hoy, horas: "3.5", combustible: "2", claveIdempotencia: claveUso });
    expect(await registrarUsoEquipo(e.servicios.agricola, sup, { equipoId, fecha: hoy, horas: "3.5", combustible: "2", claveIdempotencia: claveUso })).toMatchObject({ repetido: true });
    const claveMant = k();
    const m = await registrarMantenimiento(e.servicios.agricola, admin, { equipoId, fecha: hoy, tipo: "preventivo", descripcion: "Cambio de aceite y ajuste de piñones", costo: "85000", claveIdempotencia: claveMant });
    expect(m.gastoRegistrado).toBe(true);
    // Un reintento no duplica el mantenimiento ni el gasto.
    expect(await registrarMantenimiento(e.servicios.agricola, admin, { equipoId, fecha: hoy, tipo: "preventivo", descripcion: "Cambio de aceite y ajuste de piñones", costo: "85000", claveIdempotencia: claveMant })).toMatchObject({ repetido: true });
    const eq = (await listarEquipos(e.servicios.agricola, admin)).equipos.find((x) => x.id === equipoId)!;
    expect(eq).toMatchObject({ horasUso: "3.50", combustibleLitros: "2.00", costoMantenimiento: "85000.00", mantenimientoVencido: false });
    expect(eq.proximoMantenimiento).not.toBeNull();
    const resumen = await obtenerResumenFinanciero(e.servicios.finanzas, admin, "2020-01-01", "2035-12-31");
    expect(resumen.gastosAgricolas).toBe("85000.00");
  });

  it("un equipo en mantenimiento o de otra finca no puede usarse; el supervisor no administra equipos", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    await e.pool.query("UPDATE equipo SET estado = 'en_mantenimiento' WHERE id = $1", [equipoId]);
    const sup = await e.contexto("supervisor@demo.local");
    await expect(registrarUsoEquipo(e.servicios.agricola, sup, { equipoId, fecha: hoy, horas: "1", claveIdempotencia: k() })).rejects.toThrow(/no puede usarse/);
    await expect(crearEquipo(e.servicios.agricola, sup, { fincaId: e.ids.finca1, tipo: "herramienta", codigo: "H-1", nombre: "Tijera DEMO" })).rejects.toThrow(ErrorProhibido);
    await expect(registrarMantenimiento(e.servicios.agricola, sup, { equipoId, fecha: hoy, tipo: "correctivo", descripcion: "No permitido al supervisor", costo: "1000", claveIdempotencia: k() })).rejects.toThrow(ErrorProhibido);
    void admin;
  });
});
