import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consultarSaldos,
  consultarTrazabilidadVenta,
  crearProcesoTipo,
  ejecutarEtapa,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  listarProcesos,
  listarRegistrosProceso,
  registrarCosecha,
  registrarVenta,
} from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
let etapas: Record<string, string> = {};
let PHU = "";

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
  const r = await e.pool.query("SELECT et.id, et.codigo, t.codigo AS tipo FROM proceso_etapa et JOIN proceso_tipo t ON t.id = et.proceso_tipo_id");
  etapas = Object.fromEntries(r.rows.map((x) => [`${x.tipo}:${x.codigo}`, x.id]));
  PHU = (await e.pool.query("SELECT id FROM producto WHERE codigo = 'PHU'")).rows[0].id;
});
afterAll(async () => {
  await e.cerrar();
});

const ejecutar = (ctxCorreo: string, etapa: string, cantidadEntrada: string, cantidadSalida: string, extra: Record<string, unknown> = {}) =>
  e.contexto(ctxCorreo).then((ctx) =>
    ejecutarEtapa(e.servicios.beneficio, ctx, {
      etapaId: etapas[etapa], fincaId: e.ids.finca1, bodegaId: e.ids.bodega1, fecha: "2026-11-05", claveIdempotencia: randomUUID(),
      lineas: [{ loteId: e.ids.lote1_01, cantidadEntrada, cantidadSalida }], ...extra,
    }),
  );

describe("beneficio y poscosecha configurable", () => {
  it("cereza → pergamino húmedo → pergamino seco → excelso conserva el lote y descuenta/acredita inventario", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await registrarCosecha(e.servicios.produccion, prod, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, bodegaId: e.ids.bodega1, productoId: e.ids.CER, unidadId: e.ids.kg, fecha: "2026-11-01", cantidad: "100", claveIdempotencia: randomUUID() });

    const d = await ejecutar("produccion@demo.local", "cafe_lavado_demo:despulpado", "100", "96");
    expect(d.mermaPct).toBe("4.00");
    // La merma del secado (53,13 %) supera la esperada (50 %): se exige justificación.
    await expect(ejecutar("produccion@demo.local", "cafe_lavado_demo:secado", "96", "45")).rejects.toThrow(ErrorValidacion);
    const s = await ejecutar("produccion@demo.local", "cafe_lavado_demo:secado", "96", "45", { justificacion: "Lote con mucha humedad inicial" });
    expect(s.mermaPct).toBe("53.13");
    await ejecutar("bodega@demo.local", "cafe_lavado_demo:trilla", "40", "32");

    const saldos = await consultarSaldos(e.servicios.inventario, prod);
    const cantidad = (codigo: string) => saldos.filter((x) => x.productoCodigo === codigo && x.loteCodigo === "L-01").reduce((a, x) => a + Number(x.cantidad), 0);
    expect(cantidad("CER")).toBe(0);
    expect(cantidad("PHU")).toBe(0);
    expect(cantidad("PSE")).toBe(60 + 45 - 40);
    expect(cantidad("EXC")).toBe(25 + 32);

    const reg = await e.pool.query("SELECT merma_excede_esperada, justificacion FROM proceso_registro WHERE merma_pct = 53.13");
    expect(reg.rows[0]).toMatchObject({ merma_excede_esperada: true, justificacion: "Lote con mucha humedad inicial" });
  });

  it("la trazabilidad de una venta incluye las etapas de beneficio por las que pasó el lote", async () => {
    const com = await e.contexto("comercial@demo.local");
    const venta = await registrarVenta(e.servicios.comercial, com, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), items: [{ productoId: e.ids.EXC, cantidad: "5", loteId: e.ids.lote1_01 }] });
    const traza = await consultarTrazabilidadVenta(e.servicios.trazabilidad, com, venta.venta.id);
    const tipos = traza.lineas[0].transformaciones.map((t) => t.tipo);
    expect(tipos).toContain("Café lavado DEMO: Trilla");
    expect(tipos).toContain("Café lavado DEMO: Despulpado");
  });

  it("los movimientos de cada etapa son inmutables y el registro del proceso no se edita", async () => {
    await expect(e.pool.query("UPDATE proceso_registro SET perdida_total = 0")).rejects.toThrow();
    await expect(e.pool.query("DELETE FROM proceso_registro")).rejects.toThrow();
  });

  it("no se puede procesar más de lo que hay (el inventario no queda negativo) y un reintento no duplica", async () => {
    await expect(ejecutar("produccion@demo.local", "cafe_lavado_demo:despulpado", "5000", "4900")).rejects.toThrow(/insuficientes|Existencias/i);
    const clave = randomUUID();
    const prod = await e.contexto("produccion@demo.local");
    await registrarCosecha(e.servicios.produccion, prod, { fincaId: e.ids.finca1, loteId: e.ids.lote1_02, bodegaId: e.ids.bodega1, productoId: e.ids.CER, unidadId: e.ids.kg, fecha: "2026-11-02", cantidad: "20", claveIdempotencia: randomUUID() });
    const entrada = { etapaId: etapas["cafe_lavado_demo:despulpado"], fincaId: e.ids.finca1, bodegaId: e.ids.bodega1, fecha: "2026-11-05", claveIdempotencia: clave, lineas: [{ loteId: e.ids.lote1_02, cantidadEntrada: "20", cantidadSalida: "19" }] };
    const a = await ejecutarEtapa(e.servicios.beneficio, prod, entrada);
    const b = await ejecutarEtapa(e.servicios.beneficio, prod, entrada);
    expect(b).toMatchObject({ registroId: a.registroId, repetido: true });
    const n = await e.pool.query("SELECT count(*)::int AS n FROM proceso_registro WHERE transformacion_id = $1", [a.transformacionId]);
    expect(n.rows[0].n).toBe(1);
  });

  it("los flujos son configurables: un flujo nuevo con etapas encadenadas, y el comercial no puede registrar etapas", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    const { id } = await crearProcesoTipo(e.servicios.beneficio, admin, {
      codigo: "honey_demo", nombre: "Proceso honey DEMO",
      etapas: [
        { codigo: "despulpado_honey", nombre: "Despulpado sin lavar", productoEntradaId: e.ids.CER, productoSalidaId: PHU, mermaEsperadaPct: "6" },
        { codigo: "secado_honey", nombre: "Secado", productoEntradaId: PHU, productoSalidaId: e.ids.PSE },
      ],
    });
    expect(id).toBeTruthy();
    expect((await listarProcesos(e.servicios.beneficio, admin)).map((p) => p.codigo)).toContain("honey_demo");
    await expect(
      crearProcesoTipo(e.servicios.beneficio, admin, { codigo: "roto_demo", nombre: "Etapas rotas", etapas: [
        { codigo: "uno", nombre: "Uno", productoEntradaId: e.ids.CER, productoSalidaId: PHU },
        { codigo: "dos", nombre: "Dos", productoEntradaId: e.ids.EXC, productoSalidaId: e.ids.PSE },
      ] }),
    ).rejects.toThrow(ErrorRegla);
    const com = await e.contexto("comercial@demo.local");
    await expect(
      ejecutarEtapa(e.servicios.beneficio, com, { etapaId: etapas["cafe_lavado_demo:despulpado"], fincaId: e.ids.finca1, bodegaId: e.ids.bodega1, fecha: "2026-11-05", claveIdempotencia: randomUUID(), lineas: [{ loteId: e.ids.lote1_01, cantidadEntrada: "1", cantidadSalida: "1" }] }),
    ).rejects.toThrow(ErrorProhibido);
    expect((await listarRegistrosProceso(e.servicios.beneficio, admin)).length).toBeGreaterThanOrEqual(3);
  });
});
