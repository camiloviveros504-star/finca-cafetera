"use server";

import { revalidatePath } from "next/cache";
import { pagarCompra, recibirCompra, registrarGasto, registrarPagoCliente, servicios } from "@/composicion";
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
  return ejecutar(["/finanzas", "/inicio"], "Registrado en la billetera.", () =>
    registrarGasto(servicios().finanzas, ctx, {
      // La clasificación se deduce del tipo: solo el gasto administrativo no es agrícola.
      fincaId: t(d, "fincaId"), loteId: t(d, "loteId"), tipo: t(d, "tipo"), clasificacion: t(d, "clasificacion") || (t(d, "tipo") === "administrativo" ? "administrativo" : "agricola"), fecha: t(d, "fecha"),
      descripcion: t(d, "descripcion"), monto: dec(d, "monto"), metodo: t(d, "metodo"), claveIdempotencia: t(d, "claveIdempotencia"),
    }),
  );
}
