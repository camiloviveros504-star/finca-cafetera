"use server";

import { revalidatePath } from "next/cache";
import { crearFinca, crearLote, eliminarLote, registrarEventoLote, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "");

export async function accionCrearFinca(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await crearFinca(servicios().fincasLotes, ctx, { nombre: t(d, "nombre"), ubicacion: t(d, "ubicacion"), areaHa: t(d, "areaHa").replace(",", ".") });
    revalidatePath("/lotes");
    return { ok: true, mensaje: "Finca creada con su bodega principal." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionCrearLote(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await crearLote(servicios().fincasLotes, ctx, {
      fincaId: t(d, "fincaId"),
      codigo: t(d, "codigo"),
      nombre: t(d, "nombre"),
      areaHa: t(d, "areaHa").replace(",", "."),
      variedad: t(d, "variedad"),
      numeroArboles: t(d, "numeroArboles"),
      fechaSiembra: t(d, "fechaSiembra"),
    });
    revalidatePath("/lotes");
    return { ok: true, mensaje: "Lote creado." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionEventoLote(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await registrarEventoLote(servicios().cultivo, ctx, { loteId: t(d, "loteId"), tipo: t(d, "tipo"), fecha: t(d, "fecha"), arboles: t(d, "arboles"), detalle: t(d, "detalle") });
    revalidatePath("/lotes");
    return { ok: true, mensaje: "Registrado en el historial del lote." };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionEliminarLote(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await eliminarLote(servicios().cultivo, ctx, t(d, "loteId"));
    revalidatePath("/lotes");
    return { ok: true, mensaje: "Lote eliminado." };
  } catch (error) {
    return aEstadoError(error);
  }
}
