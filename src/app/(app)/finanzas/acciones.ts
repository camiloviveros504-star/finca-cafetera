"use server";

import { revalidatePath } from "next/cache";
import { crearProveedor, pagarCompra, recibirCompra, registrarCompra, registrarGasto, registrarPagoCliente, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "");
const dec = (d: FormData, k: string) => t(d, k).replace(",", ".");

async function ejecutar(rutas: string[], mensaje: string, fn: () => Promise<unknown>): Promise<EstadoFormulario> {
  try {
    await fn();
    for (const r of rutas) revalidatePath(r);
    return { ok: true, mensaje };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionPagoCliente(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/cartera", "/finanzas"], "Pago registrado.", () =>
    registrarPagoCliente(servicios().pagos, ctx, { ventaId: t(d, "ventaId"), monto: dec(d, "monto"), metodo: t(d, "metodo"), fecha: t(d, "fecha"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionCrearProveedor(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/compras"], "Proveedor creado.", () =>
    crearProveedor(servicios().finanzas, ctx, { nombre: t(d, "nombre"), documento: t(d, "documento"), telefono: t(d, "telefono"), correo: t(d, "correo"), autorizaTratamiento: d.get("autoriza") === "on" }),
  );
}

export async function accionRegistrarCompra(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  const lineas = [1, 2, 3]
    .filter((n) => t(d, `insumoId${n}`) !== "" || t(d, `descripcion${n}`) !== "")
    .map((n) => ({ insumoId: t(d, `insumoId${n}`) === "otro" ? "" : t(d, `insumoId${n}`), descripcion: t(d, `descripcion${n}`), cantidad: dec(d, `cantidad${n}`), unidad: t(d, `unidad${n}`) || "unidad", costoUnitario: dec(d, `costo${n}`) }));
  return ejecutar(["/compras", "/finanzas"], "Pedido de compra registrado.", () =>
    registrarCompra(servicios().finanzas, ctx, { fincaId: t(d, "fincaId"), proveedorId: t(d, "proveedorId"), fecha: t(d, "fecha"), nota: t(d, "nota"), claveIdempotencia: t(d, "claveIdempotencia"), lineas }),
  );
}

export async function accionRecibirCompra(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/compras", "/finanzas"], "Compra recibida: quedó como cuenta por pagar.", () => recibirCompra(servicios().finanzas, ctx, { compraId: t(d, "compraId"), fecha: t(d, "fecha") }));
}

export async function accionPagarCompra(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/compras", "/finanzas"], "Pago registrado.", () =>
    pagarCompra(servicios().finanzas, ctx, { compraId: t(d, "compraId"), monto: dec(d, "monto"), metodo: t(d, "metodo"), fecha: t(d, "fecha"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionRegistrarGasto(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/finanzas"], "Gasto registrado.", () =>
    registrarGasto(servicios().finanzas, ctx, {
      fincaId: t(d, "fincaId"), loteId: t(d, "loteId"), tipo: t(d, "tipo"), clasificacion: t(d, "clasificacion"), fecha: t(d, "fecha"),
      descripcion: t(d, "descripcion"), monto: dec(d, "monto"), metodo: t(d, "metodo"), claveIdempotencia: t(d, "claveIdempotencia"),
    }),
  );
}
