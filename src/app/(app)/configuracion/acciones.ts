"use server";

import { revalidatePath } from "next/cache";
import { crearVersionTarifa, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

export async function accionCrearVersionTarifa(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await crearVersionTarifa(servicios().tarifas, ctx, {
      tarifaId: String(datos.get("tarifaId") ?? ""),
      valor: String(datos.get("valor") ?? "").replace(",", "."),
      desde: String(datos.get("desde") ?? ""),
    });
    revalidatePath("/configuracion");
    return { ok: true, mensaje: `Versión ${r.version} creada. Aplica desde la fecha indicada; el histórico no cambia.` };
  } catch (error) {
    return aEstadoError(error);
  }
}
