"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { anularVenta, obtenerOpcionesVenta, registrarComprador, registrarGasto, registrarVenta, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

/**
 * Server Action: Next.js verifica que el origen de la solicitud coincida con el host (protección CSRF).
 * Venta de café por tipo con precio propio; si se escribe un comprador nuevo se crea (o se reutiliza) y si hubo flete se
 * registra como gasto ligado a la venta, de modo que el resultado de la venta ya descuenta el transporte.
 */
export async function accionRegistrarVenta(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  const t = (k: string) => String(datos.get(k) ?? "").trim();
  const dec = (k: string) => t(k).replace(",", ".");
  let ventaId: string;
  try {
    const opciones = await obtenerOpcionesVenta(servicios().comercial, ctx);
    const fincaId = t("fincaId") || opciones.fincas[0]?.id;
    if (!fincaId) return { error: "No tiene una finca asignada para vender" };
    let clienteId = t("clienteId");
    if (!clienteId && t("compradorNuevo")) clienteId = (await registrarComprador(servicios().clientes, ctx, { fincaId, nombre: t("compradorNuevo") })).id;
    if (!clienteId) return { error: "Elija el comprador o escriba uno nuevo" };
    const items = [1, 2, 3]
      .filter((n) => t("productoId" + n) !== "")
      .map((n) => ({ productoId: t("productoId" + n), cantidad: dec("kg" + n), precioKg: dec("precio" + n) || undefined }));
    const clave = t("claveIdempotencia");
    const r = await registrarVenta(servicios().comercial, ctx, {
      fincaId, clienteId, claveIdempotencia: clave, items,
      descuentoPct: dec("descuentoPct") || undefined, variedad: t("variedad") || undefined, taza: t("taza") || undefined, destino: t("destino") || undefined, nota: t("nota") || undefined,
    });
    ventaId = r.venta.id;
    if (dec("flete")) {
      const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
      await registrarGasto(servicios().finanzas, ctx, { fincaId, ventaId, tipo: "flete", clasificacion: "agricola", fecha: hoy, descripcion: t("destino") ? `Flete a ${t("destino")}` : "Flete de la venta", monto: dec("flete"), claveIdempotencia: `${clave}:flete` });
    }
  } catch (error) {
    return aEstadoError(error);
  }
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/cartera");
  redirect(`/trazabilidad/${ventaId}`);
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
