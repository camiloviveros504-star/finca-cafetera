import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  crearProveedor,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  listarCartera,
  listarCompras,
  obtenerConciliacion,
  obtenerResumenFinanciero,
  pagarCompra,
  recibirCompra,
  registrarCompra,
  registrarGasto,
  registrarPagoCliente,
  registrarVenta,
} from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
const hoy = fechaColombia();
const AMPLIO = ["2020-01-01", "2035-12-31"] as const;

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("pagos de clientes y cartera (cuentas por cobrar)", () => {
  let ventaId = "";
  it("una venta de 2 kg a 14.000 queda con saldo; el pago parcial reduce la cartera", async () => {
    const com = await e.contexto("comercial@demo.local");
    const v = await registrarVenta(e.servicios.comercial, com, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), items: [{ productoId: e.ids.PSE, cantidad: "2", loteId: e.ids.lote1_01 }] });
    ventaId = v.venta.id;
    expect((await listarCartera(e.servicios.pagos, com))[0]).toMatchObject({ ventaId, total: "28000.00", saldo: "28000.00" });
    const clave = randomUUID();
    await registrarPagoCliente(e.servicios.pagos, com, { ventaId, monto: "10000", metodo: "efectivo", fecha: hoy, claveIdempotencia: clave });
    expect(await registrarPagoCliente(e.servicios.pagos, com, { ventaId, monto: "10000", metodo: "efectivo", fecha: hoy, claveIdempotencia: clave })).toMatchObject({ repetido: true });
    expect((await listarCartera(e.servicios.pagos, com))[0]).toMatchObject({ pagado: "10000.00", saldo: "18000.00" });
  });

  it("el pago no puede superar el saldo, ni dos pagos simultáneos por el saldo completo", async () => {
    const com = await e.contexto("comercial@demo.local");
    await expect(registrarPagoCliente(e.servicios.pagos, com, { ventaId, monto: "18000.01", metodo: "efectivo", fecha: hoy, claveIdempotencia: randomUUID() })).rejects.toThrow(/supera el saldo/);
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => registrarPagoCliente(e.servicios.pagos, com, { ventaId, monto: "18000", metodo: "transferencia", fecha: hoy, claveIdempotencia: randomUUID() })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await listarCartera(e.servicios.pagos, com)).toHaveLength(0);
    await expect(e.pool.query("DELETE FROM pago_cliente")).rejects.toThrow();
  });

  it("otra finca no puede pagar ni ver esta venta; el auditor consulta pero no registra pagos", async () => {
    const otra = await e.contexto("comercial2@demo.local");
    await expect(registrarPagoCliente(e.servicios.pagos, otra, { ventaId, monto: "1", metodo: "efectivo", fecha: hoy, claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorNoEncontrado);
    const aud = await e.contexto("auditor@demo.local");
    await expect(registrarPagoCliente(e.servicios.pagos, aud, { ventaId, monto: "1", metodo: "efectivo", fecha: hoy, claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorProhibido);
    await expect(listarCartera(e.servicios.pagos, aud, false)).resolves.toBeDefined();
  });
});

describe("compras, cuentas por pagar y gastos", () => {
  let compraId = "";
  it("pedido → recepción → pago; el costo se calcula con aritmética exacta", async () => {
    const fin = await e.contexto("financiero@demo.local");
    const { id: proveedorId } = await crearProveedor(e.servicios.finanzas, fin, { nombre: "Proveedor DEMO Insumos", documento: "800000001" });
    await expect(crearProveedor(e.servicios.finanzas, fin, { nombre: "Otro DEMO", documento: "800000001" })).rejects.toThrow(/Ya existe/);
    const c = await registrarCompra(e.servicios.finanzas, fin, {
      fincaId: e.ids.finca1, proveedorId, fecha: hoy, claveIdempotencia: randomUUID(),
      lineas: [{ descripcion: "Fertilizante DEMO", cantidad: "2.5", unidad: "bulto", costoUnitario: "1000.10" }, { descripcion: "Bolsas DEMO", cantidad: "10", unidad: "unidad", costoUnitario: "500" }],
    });
    compraId = c.id;
    expect(c.total).toBe("7500.25"); // 2,5 × 1.000,10 = 2.500,25 + 5.000
    // No se paga lo que aún no se recibió.
    await expect(pagarCompra(e.servicios.finanzas, fin, { compraId, monto: "100", metodo: "efectivo", fecha: hoy, claveIdempotencia: randomUUID() })).rejects.toThrow(/ya recibida/);
    const bodega = await e.contexto("bodega@demo.local");
    await recibirCompra(e.servicios.finanzas, bodega, { compraId, fecha: hoy });
    await expect(recibirCompra(e.servicios.finanzas, bodega, { compraId, fecha: hoy })).rejects.toThrow(/ya fue recibida/);
    // El responsable de bodega recibe pero no paga.
    await expect(pagarCompra(e.servicios.finanzas, bodega, { compraId, monto: "100", metodo: "efectivo", fecha: hoy, claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorProhibido);
    await pagarCompra(e.servicios.finanzas, fin, { compraId, monto: "5000", metodo: "efectivo", fecha: hoy, claveIdempotencia: randomUUID() });
    await expect(pagarCompra(e.servicios.finanzas, fin, { compraId, monto: "2500.26", metodo: "efectivo", fecha: hoy, claveIdempotencia: randomUUID() })).rejects.toThrow(/supera el saldo/);
    const r = await Promise.allSettled(Array.from({ length: 4 }, () => pagarCompra(e.servicios.finanzas, fin, { compraId, monto: "2500.25", metodo: "transferencia", fecha: hoy, claveIdempotencia: randomUUID() })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const fila = (await listarCompras(e.servicios.finanzas, fin)).find((x) => x.id === compraId)!;
    expect(fila).toMatchObject({ estado: "recibida", total: "7500.25", pagado: "7500.25", saldo: "0.00" });
  });

  it("los gastos usan tipos configurables y validan lote y método", async () => {
    const fin = await e.contexto("financiero@demo.local");
    const base = { fincaId: e.ids.finca1, clasificacion: "agricola", fecha: hoy, descripcion: "Jornal de desyerbe DEMO", monto: "40000", metodo: "efectivo" };
    await expect(registrarGasto(e.servicios.finanzas, fin, { ...base, tipo: "inventado", claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorRegla);
    await expect(registrarGasto(e.servicios.finanzas, fin, { ...base, tipo: "mano_obra", monto: "0", claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorValidacion);
    const clave = randomUUID();
    await registrarGasto(e.servicios.finanzas, fin, { ...base, tipo: "mano_obra", loteId: e.ids.lote1_01, claveIdempotencia: clave });
    expect(await registrarGasto(e.servicios.finanzas, fin, { ...base, tipo: "mano_obra", loteId: e.ids.lote1_01, claveIdempotencia: clave })).toMatchObject({ repetido: true });
    await registrarGasto(e.servicios.finanzas, fin, { ...base, clasificacion: "administrativo", tipo: "administrativo", descripcion: "Papelería DEMO", monto: "15000", claveIdempotencia: randomUUID() });
    await expect(registrarGasto(e.servicios.finanzas, fin, { ...base, tipo: "mano_obra", loteId: e.ids.lote2_01, claveIdempotencia: randomUUID() })).rejects.toThrow(/no pertenece/);
    await expect(e.pool.query("UPDATE gasto SET monto = 1")).rejects.toThrow();
  });

  it("el resumen cuadra con los hechos: ingresos, cobrado, egresos, cuentas por pagar y flujo de caja", async () => {
    const fin = await e.contexto("financiero@demo.local");
    const r = await obtenerResumenFinanciero(e.servicios.finanzas, fin, ...AMPLIO);
    expect(r).toMatchObject({
      ingresosVentas: "28000.00", cobrado: "28000.00", cuentasPorCobrar: "0.00",
      gastosAgricolas: "40000.00", gastosAdministrativos: "15000.00", comprasRecibidas: "7500.25", manoObraLiquidada: "0.00",
      egresosDevengados: "62500.25", resultadoDevengado: "-34500.25",
      pagosProveedores: "7500.25", cuentasPorPagarProveedores: "0.00",
      flujoDeCaja: "-34500.25", // 28.000 cobrados − 7.500,25 proveedores − 55.000 gastos
    });
  });

  it("la conciliación interna suma las entradas y salidas por método de pago", async () => {
    const fin = await e.contexto("financiero@demo.local");
    const c = await obtenerConciliacion(e.servicios.finanzas, fin, ...AMPLIO);
    expect(c.totalEntradas).toBe("28000.00");
    expect(c.totalSalidas).toBe("62500.25");
    expect(c.neto).toBe("-34500.25");
    expect(c.porMetodo.map((m) => m.metodo).sort()).toEqual(["efectivo", "transferencia"]);
  });

  it("el comercial no ve el resumen financiero ni los gastos; el auditor sí los consulta", async () => {
    const com = await e.contexto("comercial@demo.local");
    await expect(obtenerResumenFinanciero(e.servicios.finanzas, com, ...AMPLIO)).rejects.toThrow(ErrorProhibido);
    const aud = await e.contexto("auditor@demo.local");
    await expect(obtenerResumenFinanciero(e.servicios.finanzas, aud, ...AMPLIO)).resolves.toBeDefined();
    await expect(registrarGasto(e.servicios.finanzas, aud, { fincaId: e.ids.finca1, tipo: "mano_obra", clasificacion: "agricola", fecha: hoy, descripcion: "No permitido", monto: "1", claveIdempotencia: randomUUID() })).rejects.toThrow(ErrorProhibido);
  });
});
