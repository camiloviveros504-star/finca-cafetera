"use server";

import { revalidatePath } from "next/cache";
import { anularCosecha, listarFincasYLotes, registrarGasto, registrarRecoleccion, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

/** Anulación auditada: compensa la entrada de inventario con un reverso; se rechaza si lo cosechado ya se usó. */
export async function accionAnularCosecha(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await anularCosecha(servicios().anulacionCosecha, ctx, { cosechaId: String(datos.get("cosechaId") ?? ""), motivo: String(datos.get("motivo") ?? "") });
    revalidatePath("/cosechas");
    revalidatePath("/inventario");
    return { ok: true, mensaje: "Cosecha anulada; el inventario quedó compensado." };
  } catch (error) {
    return aEstadoError(error);
  }
}

const MAX_FILAS = 40;

/**
 * Recolección del día (siempre café rojo). Modo "total": solo los kilos totales. Modo "trabajador": cada trabajador con sus
 * kilos y su valor por kilo, más los kilos recogidos sin trabajador (el dueño o alguien que ayudó).
 */
export async function accionRegistrarRecoleccion(_previo: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  const t = (k: string) => String(d.get(k) ?? "").trim();
  const dec = (k: string) => t(k).replace(",", ".");
  try {
    const { lotes } = await listarFincasYLotes(servicios().fincasLotes, ctx);
    const lote = lotes.find((l) => l.id === t("loteId"));
    if (!lote) return { error: "Seleccione el lote donde se recogió el café" };
    const porTrabajador = t("modo") === "trabajador";
    const filas = Math.min(Number(t("filas")) || 0, MAX_FILAS);
    const lineas = porTrabajador
      ? Array.from({ length: filas }, (_, i) => i)
          .filter((n) => t("trabajadorId" + n) !== "")
          .map((n) => ({ trabajadorId: t("trabajadorId" + n), kg: dec("kg" + n), precioKg: dec("precio" + n) || "0" }))
      : [];
    const r = await registrarRecoleccion(servicios(), ctx, {
      fincaId: lote.fincaId, loteId: lote.id, fecha: t("fecha"), claveIdempotencia: t("claveIdempotencia"), nota: t("nota"), lineas,
      kgTotal: porTrabajador ? "" : dec("kgTotal"), kgSinTrabajador: porTrabajador ? dec("kgSinTrabajador") : "",
    });
    // Cuadro "Hubo flete": el transporte del café queda como gasto del lote y sale de la billetera.
    if (d.get("conFlete") === "on" && dec("flete")) {
      await registrarGasto(servicios().finanzas, ctx, { fincaId: lote.fincaId, loteId: lote.id, tipo: "flete", clasificacion: "agricola", fecha: t("fecha"), descripcion: t("destinoFlete") ? `Flete de café a ${t("destinoFlete")}` : "Flete de café recolectado", monto: dec("flete"), claveIdempotencia: `${t("claveIdempotencia")}:flete` });
    }
    for (const ruta of ["/cosechas", "/inventario", "/trabajo", "/trabajadores", "/lotes", "/inicio", "/finanzas"]) revalidatePath(ruta);
    return { ok: true, mensaje: `Recolección registrada: ${Number(r.kg)} kg de café rojo entraron a la bodega${Number(r.kgSinTrabajador) > 0 ? ` (${Number(r.kgSinTrabajador)} kg sin trabajador)` : ""}${r.trabajadores > 0 ? `; ${r.trabajadores} trabajador(es), total a pagar $ ${Number(r.totalPagar).toLocaleString("es-CO")}` : ""}.` };
  } catch (error) {
    return aEstadoError(error);
  }
}
