"use server";

import { revalidatePath } from "next/cache";
import { eliminarRegistro, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../_servidor/errores";
import { exigirContexto } from "../_servidor/sesion";

const RUTAS = ["/clientes", "/compras", "/sanidad", "/trabajadores", "/maquinaria", "/planificacion", "/trabajo", "/inicio"];

/** Elimina un registro sin historial; si ya se usó, lo archiva (deja de verse, el historial se conserva). */
export async function accionEliminarRegistro(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const { resultado } = await eliminarRegistro(servicios().eliminacion, ctx, { tipo: String(d.get("tipo") ?? ""), id: String(d.get("id") ?? "") });
    for (const r of RUTAS) revalidatePath(r);
    return { ok: true, mensaje: resultado === "eliminado" ? "Eliminado." : "Tenía historial (ventas, compras, pagos o labores), así que se archivó: ya no aparece, pero el historial se conserva." };
  } catch (error) {
    return aEstadoError(error);
  }
}
