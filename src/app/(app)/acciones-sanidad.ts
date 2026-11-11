"use server";

import { revalidatePath } from "next/cache";
import { registrarSeguimientoCaso, reportarCasoSanitario, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../_servidor/errores";
import { exigirContexto } from "../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const RUTAS = ["/lotes", "/sanidad", "/inicio"];

/** Reporta una plaga o enfermedad en un lote, con la descripción para tratarla. */
export async function accionReportarPlaga(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const esOtra = d.get("esOtra") === "on";
    await reportarCasoSanitario(servicios().casosSanitarios, ctx, {
      loteId: t(d, "loteId"), tipo: esOtra ? "otra" : t(d, "tipo"), otroNombre: esOtra ? t(d, "otroNombre") : undefined,
      severidad: t(d, "severidad"), afectacionPct: t(d, "afectacionPct").replace(",", "."), descripcion: t(d, "descripcion"), fecha: t(d, "fecha"),
      claveIdempotencia: t(d, "claveIdempotencia"),
    });
    for (const r of RUTAS) revalidatePath(r);
    return { ok: true, mensaje: "Plaga reportada en el lote." };
  } catch (error) {
    return aEstadoError(error);
  }
}

/** Avance del tratamiento: en tratamiento, mejorando, controlada (o reaparece). Puede ligarse a la fumigación hecha. */
export async function accionSeguimientoPlaga(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await registrarSeguimientoCaso(servicios().casosSanitarios, ctx, {
      casoId: t(d, "casoId"), estado: t(d, "estado"), nota: t(d, "nota"), fecha: t(d, "fecha"), aplicacionId: t(d, "aplicacionId"),
    });
    for (const ruta of RUTAS) revalidatePath(ruta);
    return { ok: true, mensaje: r.reabierto ? "El caso se reabrió." : r.estado === "controlado" ? "Plaga controlada." : "Seguimiento registrado." };
  } catch (error) {
    return aEstadoError(error);
  }
}
