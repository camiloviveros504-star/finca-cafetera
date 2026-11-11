"use server";

import { revalidatePath } from "next/cache";
import { anularCosecha, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

/** Anulación auditada: compensa la entrada de inventario con un reverso; se rechaza si lo cosechado ya se usó. */
export async function accionAnularCosecha(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await anularCosecha(servicios().anulacionCosecha, ctx, { cosechaId: String(datos.get("cosechaId") ?? ""), motivo: String(datos.get("motivo") ?? "") });
    revalidatePath("/cosechas");
    revalidatePath("/inventario");
    return { ok: true, mensaje: "Cosecha anulada; el inventario quedó compensado." };
  } catch (error) {
    return aEstadoError(error);
  }
}
