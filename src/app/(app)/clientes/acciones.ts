"use server";

import { revalidatePath } from "next/cache";
import { crearCliente, servicios } from "@/composicion";
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
