"use server";

import { revalidatePath } from "next/cache";
import { crearFinca, editarFinca, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const datos = (d: FormData) => ({ nombre: t(d, "nombre"), ubicacion: t(d, "ubicacion"), areaHa: t(d, "areaHa").replace(",", ".") });
const RUTAS = ["/mis-fincas", "/lotes", "/inicio", "/usuarios", "/configuracion/general"];

/** El propietario registra una finca suya; queda a su nombre y ya puede crear sus lotes. */
export async function accionCrearFinca(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await crearFinca(servicios().fincasLotes, ctx, datos(d));
    for (const ruta of RUTAS) revalidatePath(ruta);
    return { ok: true, mensaje: `Finca “${t(d, "nombre")}” creada. Ya puede registrar sus lotes.` };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionEditarFinca(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await editarFinca(servicios().fincasLotes, ctx, { fincaId: t(d, "fincaId"), ...datos(d) });
    for (const ruta of RUTAS) revalidatePath(ruta);
    return { ok: true, mensaje: "Datos de la finca guardados." };
  } catch (error) {
    return aEstadoError(error);
  }
}
