import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consultarCultivo,
  crearAgroquimico,
  crearLote,
  crearProveedor,
  crearTrabajador,
  liquidarPeriodo,
  listarTrabajos,
  registrarJornada,
  registrarRecoleccion,
  consultarSaldos,
  eliminarLote,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  listarAgroquimicos,
  listarCompras,
  recibirCompra,
  registrarAplicacion,
  registrarCompra,
  registrarEventoLote,
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

describe("ciclo del lote: sin sembrar, café nuevo y zoca", () => {
  it("un lote nace sin sembrar, se siembra, se corta (zoca) y se tumba; cada paso queda en el historial", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const { id } = await crearLote(e.servicios.fincasLotes, dueno, { fincaId: e.ids.finca1, codigo: "T-01", nombre: "Lote de prueba", areaHa: "1" });
    const estado = async () => (await consultarCultivo(e.servicios.cultivo, dueno)).find((l) => l.id === id)!;

    expect(await estado()).toMatchObject({ origen: "sin_sembrar", etapa: "sin_sembrar", arbolesSugeridos: 5000 });
    await expect(registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "zoca", fecha: hoy })).rejects.toThrow(ErrorRegla); // no hay café que cortar
    await expect(registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "siembra", fecha: hoy })).rejects.toThrow(); // faltan los árboles

    await registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "siembra", fecha: "2024-03-01", arboles: "5000" });
    expect(await estado()).toMatchObject({ origen: "nuevo", numeroArboles: 5000 });
    await expect(registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "siembra", fecha: hoy, arboles: "100" })).rejects.toThrow(ErrorRegla); // ya está sembrado

    await registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "zoca", fecha: "2026-01-15" });
    const zoca = await estado();
    expect(zoca.origen).toBe("zoca");
    expect(zoca.fechaUltimaZoca).toBe("2026-01-15");

    await registrarEventoLote(e.servicios.cultivo, dueno, { loteId: id, tipo: "tumba", fecha: hoy });
    expect(await estado()).toMatchObject({ origen: "sin_sembrar", numeroArboles: null });
    expect((await estado()).eventos.map((x) => x.tipo)).toEqual(expect.arrayContaining(["siembra", "zoca", "tumba"]));

    await eliminarLote(e.servicios.cultivo, dueno, id);
    expect((await consultarCultivo(e.servicios.cultivo, dueno)).some((l) => l.id === id)).toBe(false);
  });

  it("un lote creado ya sembrado nace con su edad y su historial; el capataz no administra lotes", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const { id } = await crearLote(e.servicios.fincasLotes, dueno, { fincaId: e.ids.finca1, codigo: "T-02", nombre: "Ya sembrado", areaHa: "2", fechaSiembra: "2022-02-01", numeroArboles: "10000" });
    const l = (await consultarCultivo(e.servicios.cultivo, dueno)).find((x) => x.id === id)!;
    expect(l).toMatchObject({ origen: "nuevo", etapa: "produccion", numeroArboles: 10000 });
    expect(l.plan.length).toBeGreaterThan(0);

    const capataz = await e.contexto("capataz@demo.local");
    await expect(crearLote(e.servicios.fincasLotes, capataz, { fincaId: e.ids.finca1, codigo: "T-03", nombre: "No debe" })).rejects.toThrow(ErrorProhibido);
    await expect(eliminarLote(e.servicios.cultivo, capataz, id)).rejects.toThrow(ErrorProhibido);
  });
});

describe("insumos: compra → inventario → abonada por gramos por árbol", () => {
  it("la compra recibida suma bultos al inventario y la abonada descuenta según árboles y gramos del bulto", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const { id: insumoId } = await crearAgroquimico(e.servicios.agricola, dueno, { nombre: "Triple 15 de prueba", unidad: "bulto", tipo: "fertilizante", gramosPorUnidad: "50000", fincaId: e.ids.finca1 });
    const { id: proveedorId } = await crearProveedor(e.servicios.finanzas, dueno, { nombre: "Agroinsumos de prueba" });

    const compra = await registrarCompra(e.servicios.finanzas, dueno, {
      fincaId: e.ids.finca1, proveedorId, fecha: hoy, claveIdempotencia: k(),
      lineas: [{ insumoId, cantidad: "10", unidad: "bulto", costoUnitario: "150000" }],
    });
    const stock = async () => (await listarAgroquimicos(e.servicios.agricola, dueno)).stock.filter((s) => s.agroquimicoId === insumoId);
    expect(await stock()).toHaveLength(0); // pedida, todavía no recibida
    expect((await listarCompras(e.servicios.finanzas, dueno)).find((c) => c.id === compra.id)!.lineas[0].descripcion).toBe("Triple 15 de prueba");

    await recibirCompra(e.servicios.finanzas, dueno, { compraId: compra.id, fecha: hoy });
    const [entrada] = await stock();
    expect(Number(entrada.cantidad)).toBe(10);
    expect(entrada.vencimiento).toBeNull();
    await expect(recibirCompra(e.servicios.finanzas, dueno, { compraId: compra.id, fecha: hoy })).rejects.toThrow(ErrorRegla); // no se acredita dos veces
    expect(Number((await stock())[0].cantidad)).toBe(10);

    // Lote de 1.000 árboles × 100 g por árbol = 100.000 g = 2 bultos de 50.000 g.
    const { id: loteId } = await crearLote(e.servicios.fincasLotes, dueno, { fincaId: e.ids.finca1, codigo: "T-04", nombre: "Para abonar", areaHa: "0.2", fechaSiembra: "2025-06-01", numeroArboles: "1000" });
    const r = await registrarAplicacion(e.servicios.agricola, dueno, { stockId: entrada.id, loteId, fecha: hoy, gramosPorArbol: "100", claveIdempotencia: k() });
    expect(Number(r.cantidadTotal)).toBe(2);
    expect(Number((await stock())[0].cantidad)).toBe(8);

    // Un lote sin sembrar no puede abonarse por árbol; tampoco se descuenta más de lo que hay.
    const { id: vacio } = await crearLote(e.servicios.fincasLotes, dueno, { fincaId: e.ids.finca1, codigo: "T-05", nombre: "Sin café", areaHa: "1" });
    await expect(registrarAplicacion(e.servicios.agricola, dueno, { stockId: entrada.id, loteId: vacio, fecha: hoy, gramosPorArbol: "100", claveIdempotencia: k() })).rejects.toThrow(ErrorRegla);
    await expect(registrarAplicacion(e.servicios.agricola, dueno, { stockId: entrada.id, loteId, fecha: hoy, gramosPorArbol: "9000", claveIdempotencia: k() })).rejects.toThrow(ErrorRegla); // 180 bultos > 8
    expect(Number((await stock())[0].cantidad)).toBe(8);
  });

  it("cada finca tiene sus propios insumos: no se crean ni se compran insumos de una finca ajena", async () => {
    const dueno = await e.contexto("propietario@demo.local"); // solo tiene la finca 1
    await expect(crearAgroquimico(e.servicios.agricola, dueno, { nombre: "Insumo ajeno", unidad: "bulto", fincaId: e.ids.finca2 })).rejects.toThrow(ErrorNoEncontrado);
    const admin = await e.contexto("admin@demo.local");
    const { id: ajeno } = await crearAgroquimico(e.servicios.agricola, admin, { nombre: "Solo de la finca dos", unidad: "bulto", fincaId: e.ids.finca2 });
    expect((await listarAgroquimicos(e.servicios.agricola, dueno)).catalogo.some((x) => x.id === ajeno)).toBe(false);
    const { id: proveedorId } = await crearProveedor(e.servicios.finanzas, dueno, { nombre: "Otro proveedor de prueba" });
    await expect(
      registrarCompra(e.servicios.finanzas, dueno, { fincaId: e.ids.finca1, proveedorId, fecha: hoy, claveIdempotencia: k(), lineas: [{ insumoId: ajeno, cantidad: "1", unidad: "bulto", costoUnitario: "1000" }] }),
    ).rejects.toThrow(ErrorRegla);
  });
});

describe("recolección y labores por trabajador", () => {
  const nuevoTrabajador = (dueno: Awaited<ReturnType<Entorno["contexto"]>>, doc: string, nombres: string) =>
    crearTrabajador(e.servicios.talento, dueno, { tipoDocumento: "CC", numeroDocumento: doc, nombres, apellidos: "De prueba", fincaId: e.ids.finca1, modalidad: "kg", autorizaTratamiento: true });

  it("un formulario registra la cosecha en bodega y lo que se le debe a cada recolector; reenviarlo no duplica", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const { id: ana } = await nuevoTrabajador(dueno, "7000001", "Ana");
    const { id: luis } = await nuevoTrabajador(dueno, "7000002", "Luis");
    const entrada = {
      fincaId: e.ids.finca1, loteId: e.ids.lote1_01, productoId: e.ids.CER, fecha: hoy, claveIdempotencia: k(),
      lineas: [{ trabajadorId: ana, kg: "80.5", precioKg: "1000" }, { trabajadorId: luis, kg: "60", precioKg: "1200" }],
    };
    const kgBodega = async () => (await consultarSaldos(e.servicios.inventario, dueno, e.ids.finca1)).filter((x) => x.productoCodigo === "CER" && x.loteCodigo === "L-01").reduce((a, x) => a + Number(x.cantidad), 0);
    const antes = await kgBodega();

    const r = await registrarRecoleccion(e.servicios, dueno, entrada);
    expect(r).toMatchObject({ kg: "140.500", trabajadores: 2, totalPagar: "152500.00", repetida: false }); // 80,5 × 1.000 + 60 × 1.200
    expect(await kgBodega()).toBeCloseTo(antes + 140.5);

    expect(await registrarRecoleccion(e.servicios, dueno, entrada)).toMatchObject({ repetida: true });
    expect(await kgBodega()).toBeCloseTo(antes + 140.5); // no se suma dos veces
    const registros = (await listarTrabajos(e.servicios.talento, dueno)).filter((x) => x.trabajadorId === ana);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ estado: "validado", valor: "80500.00", labor: "recoleccion" });

    // Lo recolectado queda listo para liquidar: el neto sale de kilos × valor por kilo.
    const liq = await liquidarPeriodo(e.servicios.talento, dueno, { trabajadorId: ana, desde: hoy, hasta: hoy });
    expect(liq.neto).toBe("80500.00");
  });

  it("labores por jornal (abonada, fumigación, limpieza), capataz autorizado y trabajador sin acceso", async () => {
    const capataz = await e.contexto("capataz@demo.local");
    const dueno = await e.contexto("propietario@demo.local");
    const { id: pedro } = await nuevoTrabajador(dueno, "7000003", "Pedro");
    const base = { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, fecha: hoy, labor: "abonada", lineas: [{ trabajadorId: pedro, cantidad: "1", unidad: "jornada", valorUnitario: "60000" }] };
    expect(await registrarJornada(e.servicios.talento, capataz, { ...base, claveIdempotencia: k() })).toMatchObject({ total: "60000.00" });
    await expect(registrarJornada(e.servicios.talento, capataz, { ...base, claveIdempotencia: k(), labor: "volar" })).rejects.toThrow();
    await expect(registrarJornada(e.servicios.talento, capataz, { ...base, claveIdempotencia: k(), lineas: [{ trabajadorId: pedro, cantidad: "1", unidad: "jornada", valorUnitario: "0" }] })).rejects.toThrow(ErrorValidacion);
    await expect(registrarJornada(e.servicios.talento, capataz, { ...base, claveIdempotencia: k(), fecha: "2099-01-01" })).rejects.toThrow(ErrorValidacion);

    const obrero = await e.contexto("trabajador@demo.local");
    await expect(registrarJornada(e.servicios.talento, obrero, { ...base, claveIdempotencia: k() })).rejects.toThrow(ErrorProhibido);
    await expect(registrarRecoleccion(e.servicios, obrero, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, productoId: e.ids.CER, fecha: hoy, claveIdempotencia: k(), kgTotal: "10", lineas: [] })).rejects.toThrow(ErrorProhibido);
    // El trabajador solo ve lo suyo: nunca los registros de Pedro.
    expect((await listarTrabajos(e.servicios.talento, obrero)).every((x) => x.trabajadorId !== pedro)).toBe(true);
  });
});
