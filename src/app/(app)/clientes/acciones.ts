"use server";

import { revalidatePath } from "next/cache";
import { anonimizarCliente, crearCliente, rectificarCliente, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

export async function accionCrearCliente(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await crearCliente(servicios().clientes, ctx, {
      nombre: String(d.get("nombre") ?? ""),
      documento: String(d.get("documento") ?? ""),
      telefono: String(d.get("telefono") ?? ""),
      correo: String(d.get("correo") ?? ""),
      direccion: String(d.get("direccion") ?? ""),
      autorizaTratamiento: d.get("autorizaTratamiento") === "on",
    });
    revalidatePath("/clientes");
    return { ok: true, mensaje: "Cliente registrado." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionRectificarCliente(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  const t = (k: string) => String(datos.get(k) ?? "");
  try {
    await rectificarCliente(servicios().derechosCliente, ctx, { clienteId: t("clienteId"), nombre: t("nombre") || undefined, telefono: t("telefono"), correo: t("correo"), direccion: t("direccion") });
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${t("clienteId")}`);
    return { ok: true, mensaje: "Datos rectificados." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionAnonimizarCliente(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await anonimizarCliente(servicios().derechosCliente, ctx, { clienteId: String(datos.get("clienteId") ?? ""), motivo: String(datos.get("motivo") ?? "") });
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${String(datos.get("clienteId") ?? "")}`);
    return { ok: true, mensaje: "Datos personales suprimidos (anonimizados). Las ventas conservan su valor." };
  } catch (error) {
    return aEstadoError(error);
  }
}
