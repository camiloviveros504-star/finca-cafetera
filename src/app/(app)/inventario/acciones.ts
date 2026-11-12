"use server";

import { revalidatePath } from "next/cache";
import { avanzarCafe, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const dec = (d: FormData, k: string) => t(d, k).replace(",", ".");

/** Un paso del camino del café (despulpar, lavar, poner a secar, terminar el secado, trillar, tostar o moler). */
export async function accionAvanzarCafe(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await avanzarCafe(servicios().beneficio, ctx, {
      paso: t(d, "paso"), fincaId: t(d, "fincaId"), loteId: t(d, "loteId"), fecha: t(d, "fecha"),
      kgEntrada: dec(d, "kgEntrada"), kgSalida: dec(d, "kgSalida"), claveIdempotencia: t(d, "claveIdempotencia"), nota: t(d, "nota"),
    });
    for (const ruta of ["/inventario", "/ventas/nueva", "/inicio"]) revalidatePath(ruta);
    const entra = Number(r.kgEntrada);
    const sale = Number(r.kgSalida);
    return { ok: true, mensaje: entra === sale ? `${r.paso}: ${entra} kg registrados.` : `${r.paso}: entraron ${entra} kg y quedaron ${sale} kg (rendimiento ${Math.round((sale / entra) * 1000) / 10} %).` };
  } catch (error) {
    return aEstadoError(error);
  }
}
