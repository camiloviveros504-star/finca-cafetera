import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearCliente, crearPedido, ErrorProhibido, ErrorValidacion, listarClientes, obtenerPanel } from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno({ poolMax: 5 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("clientes, pedidos y Ley 1581", () => {
  it("no se guarda un cliente sin la autorización de tratamiento de datos", async () => {
    const com = await e.contexto("comercial@demo.local");
    await expect(crearCliente(e.servicios.clientes, com, { nombre: "Cliente sin permiso", autorizaTratamiento: false })).rejects.toThrow(ErrorValidacion);
    await expect(crearCliente(e.servicios.clientes, com, { nombre: "Cliente sin permiso" })).rejects.toMatchObject({ campos: { autorizaTratamiento: expect.stringMatching(/autorizó/) } });
  });

  it("guarda la autorización con fecha y la auditoría no contiene datos personales", async () => {
    const com = await e.contexto("comercial@demo.local");
    const { id } = await crearCliente(e.servicios.clientes, com, { nombre: "Tostadora Demo Sur", documento: "800123456", correo: "demo@demo.local", autorizaTratamiento: true });
    const c = await e.pool.query("SELECT autorizo_tratamiento_en, finalidad_tratamiento FROM cliente WHERE id = $1", [id]);
    expect(c.rows[0].autorizo_tratamiento_en).not.toBeNull();
    expect(c.rows[0].finalidad_tratamiento).toMatch(/comercial/i);
    const aud = await e.pool.query("SELECT antes, despues FROM auditoria WHERE accion = 'cliente.crear' AND entidad_id = $1", [id]);
    expect(JSON.stringify(aud.rows)).not.toMatch(/800123456|demo@demo.local|Tostadora/);
    const lista = await listarClientes(e.servicios.clientes, com, 1, "Demo Sur");
    expect(lista.filas.map((f) => f.nombre)).toContain("Tostadora Demo Sur");
  });

  it("el encargado de producción no administra clientes ni pedidos", async () => {
    const prod = await e.contexto("produccion@demo.local");
    await expect(crearCliente(e.servicios.clientes, prod, { nombre: "X Y", autorizaTratamiento: true })).rejects.toThrow(ErrorProhibido);
    await expect(crearPedido(e.servicios.clientes, prod, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, items: [{ productoId: e.ids.PSE, cantidad: "1" }] })).rejects.toThrow(ErrorProhibido);
  });

  it("un pedido no descuenta inventario", async () => {
    const com = await e.contexto("comercial@demo.local");
    const antes = await e.pool.query("SELECT sum(cantidad) AS n FROM saldo_inventario");
    await crearPedido(e.servicios.clientes, com, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, items: [{ productoId: e.ids.PSE, cantidad: "5" }] });
    const despues = await e.pool.query("SELECT sum(cantidad) AS n FROM saldo_inventario");
    expect(despues.rows[0].n).toBe(antes.rows[0].n);
  });

  it("el panel solo muestra los indicadores que el rol puede ver", async () => {
    const com = await obtenerPanel(e.servicios.panel, await e.contexto("comercial@demo.local"));
    expect(com.ventasMes).toBeDefined();
    expect(com.cosechasMes).toBeUndefined();
    const prod = await obtenerPanel(e.servicios.panel, await e.contexto("produccion@demo.local"));
    expect(prod.cosechasMes).toBeDefined();
    expect(prod.ventasMes).toBeUndefined();
    const otra = await obtenerPanel(e.servicios.panel, await e.contexto("comercial2@demo.local"));
    expect(otra.existencias?.reduce((s, x) => s + Number(x.kg), 0)).toBe(30); // solo la finca 2
  });
});
