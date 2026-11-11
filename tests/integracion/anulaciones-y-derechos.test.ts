import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonimizarCliente,
  anonimizarTrabajador,
  anularCosecha,
  anularVenta,
  ErrorProhibido,
  exportarDatosCliente,
  exportarDatosTrabajador,
  guardarParametro,
  listarCartera,
  rectificarCliente,
  rectificarTrabajador,
  registrarCosecha,
  registrarPagoCliente,
  registrarVenta,
  transformar,
} from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
const saldo = async (codigo: string, loteId: string, bodegaId = e.ids.bodega1) =>
  Number((await e.pool.query("SELECT coalesce(sum(s.cantidad),0) AS c FROM saldo_inventario s JOIN producto p ON p.id = s.producto_id WHERE p.codigo = $1 AND s.lote_id = $2 AND s.bodega_id = $3", [codigo, loteId, bodegaId])).rows[0].c);
const vender = async (items: { productoId: string; cantidad: string; loteId?: string }[], extra: Record<string, unknown> = {}) => {
  const com = await e.contexto("comercial@demo.local");
  return registrarVenta(e.servicios.comercial, com, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), items, ...extra });
};

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("descuentos autorizados", () => {
  it("sin máximo configurado no hay descuentos; con máximo, solo hasta ese tope y exacto al centavo", async () => {
    await expect(vender([{ productoId: e.ids.PSE, cantidad: "1", loteId: e.ids.lote1_01 }], { descuentoPct: "5" })).rejects.toThrow(/máximo autorizado/);
    const admin = await e.contexto("admin@demo.local");
    await guardarParametro(e.servicios.ajustes, admin, { clave: "descuento_maximo_pct", valor: "10" });
    await expect(vender([{ productoId: e.ids.PSE, cantidad: "1", loteId: e.ids.lote1_01 }], { descuentoPct: "10.01" })).rejects.toThrow(/máximo autorizado/);
    const v = await vender([{ productoId: e.ids.PSE, cantidad: "10", loteId: e.ids.lote1_01 }], { descuentoPct: "10" });
    expect(v.venta.total).toBe("126000.00"); // 10 kg × 14.000 = 140.000 − 10 %
    const fila = await e.pool.query("SELECT descuento_total FROM venta WHERE id = $1", [v.venta.id]);
    expect(fila.rows[0].descuento_total).toBe("14000.00");
    const det = await e.pool.query("SELECT precio_unitario, descuento, subtotal FROM venta_detalle WHERE venta_id = $1", [v.venta.id]);
    expect(det.rows[0]).toMatchObject({ precio_unitario: "14000.00", descuento: "14000.00", subtotal: "126000.00" });
  });

  it("el responsable de bodega no puede vender ni descontar (403)", async () => {
    const bod = await e.contexto("bodega@demo.local");
    await expect(registrarVenta(e.servicios.comercial, bod, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), descuentoPct: "5", items: [{ productoId: e.ids.PSE, cantidad: "1" }] })).rejects.toThrow(ErrorProhibido);
  });
});

describe("anulación de ventas (corrección auditada con reverso)", () => {
  it("devuelve las existencias al lote, deja la venta anulada con motivo y no se puede repetir", async () => {
    const antes = await saldo("PSE", e.ids.lote1_01);
    const v = await vender([{ productoId: e.ids.PSE, cantidad: "7", loteId: e.ids.lote1_01 }]);
    expect(await saldo("PSE", e.ids.lote1_01)).toBe(antes - 7);
    const admin = await e.contexto("admin@demo.local");
    const r = await anularVenta(e.servicios.anulacionVenta, admin, { ventaId: v.venta.id, motivo: "Error en la cantidad digitada por el cliente" });
    expect(r.movimientosRevertidos).toBe(1);
    expect(await saldo("PSE", e.ids.lote1_01)).toBe(antes);
    const fila = await e.pool.query("SELECT estado, motivo_anulacion, anulada_por FROM venta WHERE id = $1", [v.venta.id]);
    expect(fila.rows[0]).toMatchObject({ estado: "anulada", motivo_anulacion: "Error en la cantidad digitada por el cliente" });
    expect(fila.rows[0].anulada_por).not.toBeNull();
    const mov = await e.pool.query("SELECT count(*)::int AS n FROM movimiento_inventario WHERE tipo = 'reverso' AND delta = 7");
    expect(mov.rows[0].n).toBe(1);
    await expect(anularVenta(e.servicios.anulacionVenta, admin, { ventaId: v.venta.id, motivo: "Segundo intento de anulación" })).rejects.toThrow(/ya está anulada/);
  });

  it("solo el administrador anula; una venta con pagos no se anula; las ventas anuladas salen de la cartera", async () => {
    const com = await e.contexto("comercial@demo.local");
    const v = await vender([{ productoId: e.ids.PSE, cantidad: "2", loteId: e.ids.lote1_02 }]);
    await expect(anularVenta(e.servicios.anulacionVenta, com, { ventaId: v.venta.id, motivo: "No tengo permiso para esto" })).rejects.toThrow(ErrorProhibido);
    await registrarPagoCliente(e.servicios.pagos, com, { ventaId: v.venta.id, monto: "1000", metodo: "efectivo", fecha: fechaColombia(), claveIdempotencia: randomUUID() });
    const admin = await e.contexto("admin@demo.local");
    await expect(anularVenta(e.servicios.anulacionVenta, admin, { ventaId: v.venta.id, motivo: "Intento con pagos registrados" })).rejects.toThrow(/pagos registrados/);
    const otra = await vender([{ productoId: e.ids.PSE, cantidad: "1", loteId: e.ids.lote1_02 }]);
    await anularVenta(e.servicios.anulacionVenta, admin, { ventaId: otra.venta.id, motivo: "Venta duplicada por error" });
    expect((await listarCartera(e.servicios.pagos, com)).map((f) => f.ventaId)).not.toContain(otra.venta.id);
  });

  it("anulaciones simultáneas de la misma venta: solo una compensa el inventario", async () => {
    const antes = await saldo("EXC", e.ids.lote1_01);
    const v = await vender([{ productoId: e.ids.EXC, cantidad: "5", loteId: e.ids.lote1_01 }]);
    const admin = await e.contexto("admin@demo.local");
    const r = await Promise.allSettled(Array.from({ length: 5 }, () => anularVenta(e.servicios.anulacionVenta, admin, { ventaId: v.venta.id, motivo: "Anulación concurrente de prueba" })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await saldo("EXC", e.ids.lote1_01)).toBe(antes);
  });
});

describe("anulación de cosechas", () => {
  const cosechar = async (cantidad: string) => {
    const enc = await e.contexto("produccion@demo.local");
    const r = await registrarCosecha(e.servicios.produccion, enc, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, bodegaId: e.ids.bodega1, productoId: e.ids.CER, unidadId: e.ids.kg, fecha: "2026-11-02", cantidad, claveIdempotencia: randomUUID() });
    return r.cosecha.id;
  };

  it("compensa la entrada de inventario y deja la cosecha anulada", async () => {
    const id = await cosechar("30");
    expect(await saldo("CER", e.ids.lote1_01)).toBe(30);
    const enc = await e.contexto("produccion@demo.local");
    await expect(anularCosecha(e.servicios.anulacionCosecha, enc, { cosechaId: id, motivo: "El encargado no tiene permiso" })).rejects.toThrow(ErrorProhibido);
    const admin = await e.contexto("admin@demo.local");
    await anularCosecha(e.servicios.anulacionCosecha, admin, { cosechaId: id, motivo: "Registrada en el lote equivocado" });
    expect(await saldo("CER", e.ids.lote1_01)).toBe(0);
    expect((await e.pool.query("SELECT estado FROM cosecha WHERE id = $1", [id])).rows[0].estado).toBe("anulada");
    await expect(anularCosecha(e.servicios.anulacionCosecha, admin, { cosechaId: id, motivo: "Segundo intento de anulación" })).rejects.toThrow(/ya está anulada/);
  });

  it("si parte de lo cosechado ya se transformó, no se puede anular (el inventario no queda negativo)", async () => {
    const id = await cosechar("20");
    const enc = await e.contexto("produccion@demo.local");
    const PHU = (await e.pool.query("SELECT id FROM producto WHERE codigo = 'PHU'")).rows[0].id;
    await transformar(e.servicios.operaciones, enc, { fincaId: e.ids.finca1, bodegaId: e.ids.bodega1, tipo: "Despulpado de prueba", fecha: "2026-11-03", claveIdempotencia: randomUUID(), lineas: [{ loteId: e.ids.lote1_01, productoEntradaId: e.ids.CER, productoSalidaId: PHU, cantidadEntrada: "15", cantidadSalida: "14" }] });
    const admin = await e.contexto("admin@demo.local");
    await expect(anularCosecha(e.servicios.anulacionCosecha, admin, { cosechaId: id, motivo: "Intento de anular lo ya transformado" })).rejects.toThrow(/ya fue transformado/);
    expect(await saldo("CER", e.ids.lote1_01)).toBe(5);
  });
});

describe("derechos del titular (Ley 1581)", () => {
  it("el cliente puede conocer, rectificar y suprimir sus datos; las ventas siguen cuadrando", async () => {
    const admin = await e.contexto("admin@demo.local");
    const com = await e.contexto("comercial@demo.local");
    const v = await vender([{ productoId: e.ids.PSE, cantidad: "1", loteId: e.ids.lote1_01 }]);
    const exportado = await exportarDatosCliente(e.servicios.derechosCliente, admin, e.ids.clienteA);
    expect(exportado.titular.nombre).toContain("Cliente DEMO");
    expect(exportado.resumenComercial.ventas).toBeGreaterThanOrEqual(1);
    await rectificarCliente(e.servicios.derechosCliente, com, { clienteId: e.ids.clienteA, telefono: "3000000000", correo: "nuevo@cliente.demo" });
    expect((await exportarDatosCliente(e.servicios.derechosCliente, admin, e.ids.clienteA)).titular.correo).toBe("nuevo@cliente.demo");
    // El comercial administra clientes pero no atiende solicitudes de supresión ni exportación.
    await expect(anonimizarCliente(e.servicios.derechosCliente, com, { clienteId: e.ids.clienteA, motivo: "Solicitud del titular recibida" })).rejects.toThrow(ErrorProhibido);
    await expect(exportarDatosCliente(e.servicios.derechosCliente, com, e.ids.clienteA)).rejects.toThrow(ErrorProhibido);
    await anonimizarCliente(e.servicios.derechosCliente, admin, { clienteId: e.ids.clienteA, motivo: "Solicitud del titular recibida por escrito" });
    const fila = await e.pool.query("SELECT nombre, documento, telefono, correo, direccion, activo FROM cliente WHERE id = $1", [e.ids.clienteA]);
    expect(fila.rows[0]).toMatchObject({ nombre: "Cliente anonimizado", documento: null, telefono: null, correo: null, direccion: null, activo: false });
    expect((await e.pool.query("SELECT cliente_id, total FROM venta WHERE id = $1", [v.venta.id])).rows[0]).toMatchObject({ cliente_id: e.ids.clienteA });
    await expect(rectificarCliente(e.servicios.derechosCliente, com, { clienteId: e.ids.clienteA, nombre: "Otro Nombre" })).rejects.toThrow(/suprimidos/);
    // La auditoría registra la acción sin copiar los datos personales.
    const aud = await e.pool.query("SELECT count(*)::int AS n FROM auditoria WHERE accion LIKE 'cliente.%' AND (despues::text LIKE '%nuevo@cliente.demo%' OR despues::text LIKE '%3000000000%')");
    expect(aud.rows[0].n).toBe(0);
  });

  it("el trabajador puede conocer, rectificar y suprimir sus datos; los registros económicos se conservan", async () => {
    const admin = await e.contexto("admin@demo.local");
    const w = (await e.pool.query("SELECT id FROM trabajador WHERE numero_documento = '1000000003'")).rows[0].id;
    const exportado = await exportarDatosTrabajador(e.servicios.derechosTrabajador, admin, w);
    expect(exportado.titular.numeroDocumento).toBe("1000000003");
    await rectificarTrabajador(e.servicios.derechosTrabajador, admin, { trabajadorId: w, telefono: "3111111111" });
    const sup = await e.contexto("supervisor@demo.local");
    await expect(anonimizarTrabajador(e.servicios.derechosTrabajador, sup, { trabajadorId: w, motivo: "Intento sin permiso suficiente" })).rejects.toThrow(ErrorProhibido);
    const r = await anonimizarTrabajador(e.servicios.derechosTrabajador, admin, { trabajadorId: w, motivo: "Solicitud del titular recibida por escrito" });
    expect(r.usuarioVinculadoPorDesactivar).toBe(false);
    const fila = await e.pool.query("SELECT nombres, apellidos, numero_documento, telefono, activo FROM trabajador WHERE id = $1", [w]);
    expect(fila.rows[0]).toMatchObject({ nombres: "Trabajador", apellidos: "anonimizado", telefono: null, activo: false });
    expect(fila.rows[0].numero_documento).toMatch(/^ANON-/);
    await expect(rectificarTrabajador(e.servicios.derechosTrabajador, admin, { trabajadorId: w, nombres: "Nuevo Nombre" })).rejects.toThrow(/suprimidos/);
  });
});
