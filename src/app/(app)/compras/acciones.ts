"use server";

import { revalidatePath } from "next/cache";
import { crearProveedor, listarAgroquimicos, listarFincasYLotes, pagarCompra, recibirCompra, registrarCompra, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const RUTAS = ["/compras", "/sanidad", "/finanzas", "/inicio"];

/**
 * Compra de insumos en un solo formulario: proveedor (existente o nuevo), productos, y dos cuadros opcionales.
 * “Ya lo recibí” suma lo comprado al inventario de insumos; “Ya lo pagué” registra el pago y lo descuenta de la billetera.
 * Cada paso usa una clave derivada del formulario: si algo falla a mitad, reenviar no duplica lo que ya quedó.
 */
export async function accionCompraInsumos(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  const t = (k: string) => String(d.get(k) ?? "").trim();
  const dec = (k: string) => t(k).replace(",", ".");
  try {
    const { fincas } = await listarFincasYLotes(servicios().fincasLotes, ctx);
    const fincaId = t("fincaId") || fincas[0]?.id;
    if (!fincaId) return { error: "No tiene una finca asignada" };
    let proveedorId = t("proveedorId");
    if (!proveedorId && t("proveedorNuevo")) proveedorId = (await crearProveedor(servicios().finanzas, ctx, { nombre: t("proveedorNuevo"), fincaId })).id;
    if (!proveedorId) return { error: "Elija el proveedor o escriba uno nuevo" };

    const catalogo = await listarAgroquimicos(servicios().agricola, ctx).then((x) => x.catalogo).catch(() => []);
    const unidadDe = new Map(catalogo.map((i) => [i.id, i.unidad]));
    const lineas = [1, 2, 3]
      // El primer producto puede ser “otro” (no está en la lista): se describe y no va al inventario de insumos.
      .filter((n) => t(`insumoId${n}`) !== "" || (n === 1 && d.get("esOtro") === "on"))
      .map((n) => {
        const otro = n === 1 && d.get("esOtro") === "on";
        return {
          insumoId: otro ? undefined : t(`insumoId${n}`),
          descripcion: otro ? t(`descripcion${n}`) : undefined,
          cantidad: dec(`cantidad${n}`),
          unidad: otro ? t(`unidad${n}`) || "unidad" : unidadDe.get(t(`insumoId${n}`)) ?? "unidad",
          costoUnitario: dec(`costo${n}`),
        };
      });
    const clave = t("claveIdempotencia");
    const fecha = t("fecha");
    const compra = await registrarCompra(servicios().finanzas, ctx, { fincaId, proveedorId, fecha, claveIdempotencia: clave, lineas });
    const pasos: string[] = [];
    if (d.get("recibido") === "on" || d.get("pagado") === "on") {
      try {
        await recibirCompra(servicios().finanzas, ctx, { compraId: compra.id, fecha });
        pasos.push("recibida (sumó al inventario)");
      } catch (error) {
        // Reenvío del mismo formulario: la compra ya estaba recibida.
        if (!(error instanceof Error && /ya fue recibida/.test(error.message))) throw error;
      }
    }
    if (d.get("pagado") === "on") {
      await pagarCompra(servicios().finanzas, ctx, { compraId: compra.id, monto: compra.total, metodo: t("metodo") || "efectivo", fecha, claveIdempotencia: `${clave}:pago` });
      pasos.push("pagada");
    }
    for (const r of RUTAS) revalidatePath(r);
    return { ok: true, mensaje: `Compra registrada${pasos.length ? ` y ${pasos.join(" y ")}` : ""}.` };
  } catch (error) {
    return aEstadoError(error);
  }
}
