"use server";

import { revalidatePath } from "next/cache";
import { registrarAjuste, reversarMovimiento, servicios, trasladar, transformar } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../../_servidor/errores";
import { exigirContexto } from "../../../_servidor/sesion";

const texto = (d: FormData, k: string) => String(d.get(k) ?? "");
const numero = (d: FormData, k: string) => texto(d, k).replace(",", ".");

export async function accionAjuste(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await registrarAjuste(servicios().operaciones, ctx, {
      fincaId: texto(d, "fincaId"),
      bodegaId: texto(d, "bodegaId"),
      productoId: texto(d, "productoId"),
      loteId: texto(d, "loteId"),
      tipo: texto(d, "tipo"),
      sentido: texto(d, "sentido") || undefined,
      cantidad: numero(d, "cantidad"),
      motivo: texto(d, "motivo"),
      claveIdempotencia: texto(d, "claveIdempotencia"),
    });
    revalidatePath("/inventario/operaciones");
    return { ok: true, mensaje: "Movimiento registrado." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionTraslado(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await trasladar(servicios().operaciones, ctx, {
      fincaId: texto(d, "fincaId"),
      bodegaOrigenId: texto(d, "bodegaOrigenId"),
      bodegaDestinoId: texto(d, "bodegaDestinoId"),
      productoId: texto(d, "productoId"),
      loteId: texto(d, "loteId"),
      cantidad: numero(d, "cantidad"),
      claveIdempotencia: texto(d, "claveIdempotencia"),
    });
    revalidatePath("/inventario/operaciones");
    return { ok: true, mensaje: "Traslado registrado." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionTransformacion(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await transformar(servicios().operaciones, ctx, {
      fincaId: texto(d, "fincaId"),
      bodegaId: texto(d, "bodegaId"),
      tipo: texto(d, "tipo"),
      fecha: texto(d, "fecha"),
      claveIdempotencia: texto(d, "claveIdempotencia"),
      lineas: [
        {
          loteId: texto(d, "loteId"),
          productoEntradaId: texto(d, "productoEntradaId"),
          productoSalidaId: texto(d, "productoSalidaId"),
          cantidadEntrada: numero(d, "cantidadEntrada"),
          cantidadSalida: numero(d, "cantidadSalida"),
        },
      ],
    });
    revalidatePath("/inventario/operaciones");
    return { ok: true, mensaje: "Transformación registrada: el lote de origen se conserva." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionReverso(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await reversarMovimiento(servicios().operaciones, ctx, { movimientoId: texto(d, "movimientoId"), motivo: texto(d, "motivo") });
    revalidatePath("/inventario/operaciones");
    return { ok: true, mensaje: "Movimiento reversado." };
  } catch (error) {
    return aEstadoError(error);
  }
}
