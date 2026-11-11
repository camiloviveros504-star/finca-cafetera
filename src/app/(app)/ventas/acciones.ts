"use server";

import { redirect } from "next/navigation";
import { registrarVenta, servicios } from "@/composicion";
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
