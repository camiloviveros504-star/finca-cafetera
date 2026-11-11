"use server";

import { revalidatePath } from "next/cache";
import { crearProcesoTipo, ejecutarEtapa, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "");
const dec = (d: FormData, k: string) => t(d, k).replace(",", ".");

export async function accionEjecutarEtapa(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await ejecutarEtapa(servicios().beneficio, ctx, {
      etapaId: t(d, "etapaId"),
      fincaId: t(d, "fincaId"),
      bodegaId: t(d, "bodegaId"),
      fecha: t(d, "fecha"),
      claveIdempotencia: t(d, "claveIdempotencia"),
      justificacion: t(d, "justificacion") || undefined,
      lineas: [{ loteId: t(d, "loteId"), cantidadEntrada: dec(d, "cantidadEntrada"), cantidadSalida: dec(d, "cantidadSalida") }],
    });
    revalidatePath("/beneficio");
    revalidatePath("/inventario");
    return { ok: true, mensaje: `Etapa registrada. Merma: ${r.mermaPct} %.` };
  } catch (error) {
    return aEstadoError(error);
  }
}

/** Crea un flujo de una o dos etapas desde el formulario; flujos más largos se configuran por la misma función de aplicación. */
export async function accionCrearProceso(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const etapas = [1, 2, 3]
      .filter((n) => t(d, `codigo${n}`) !== "")
      .map((n) => ({
        codigo: t(d, `codigo${n}`),
        nombre: t(d, `nombre${n}`),
        productoEntradaId: t(d, `entrada${n}`),
        productoSalidaId: t(d, `salida${n}`),
        mermaEsperadaPct: dec(d, `merma${n}`) || undefined,
      }));
    await crearProcesoTipo(servicios().beneficio, ctx, { codigo: t(d, "codigo"), nombre: t(d, "nombre"), etapas });
    revalidatePath("/beneficio");
    return { ok: true, mensaje: "Flujo de proceso creado." };
  } catch (error) {
    return aEstadoError(error);
  }
}
