"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { anularVenta, registrarVenta, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

/** Server Action: Next.js verifica que el origen de la solicitud coincida con el host (protección CSRF). */
export async function accionRegistrarVenta(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  let id: string;
  try {
    const resultado = await registrarVenta(servicios().comercial, ctx, {
      fincaId: String(datos.get("fincaId") ?? ""),
      clienteId: String(datos.get("clienteId") ?? ""),
      claveIdempotencia: String(datos.get("claveIdempotencia") ?? ""),
      descuentoPct: String(datos.get("descuentoPct") ?? "").replace(",", ".") || undefined,
      items: [
        {
          productoId: String(datos.get("productoId") ?? ""),
          cantidad: String(datos.get("cantidad") ?? "").replace(",", "."),
        },
      ],
    });
    id = resultado.venta.id;
  } catch (error) {
    return aEstadoError(error);
  }
  redirect(`/trazabilidad/${id}`);
}

/** Anulación auditada: compensa el inventario con reversos y deja la venta anulada con motivo. */
export async function accionAnularVenta(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await anularVenta(servicios().anulacionVenta, ctx, { ventaId: String(datos.get("ventaId") ?? ""), motivo: String(datos.get("motivo") ?? "") });
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    return { ok: true, mensaje: "Venta anulada; las existencias volvieron a su lote." };
  } catch (error) {
    return aEstadoError(error);
  }
}
