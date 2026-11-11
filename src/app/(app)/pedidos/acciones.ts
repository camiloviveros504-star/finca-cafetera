"use server";

import { revalidatePath } from "next/cache";
import { crearPedido, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

export async function accionCrearPedido(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await crearPedido(servicios().clientes, ctx, {
      fincaId: String(d.get("fincaId") ?? ""),
      clienteId: String(d.get("clienteId") ?? ""),
      items: [{ productoId: String(d.get("productoId") ?? ""), cantidad: String(d.get("cantidad") ?? "").replace(",", ".") }],
    });
    revalidatePath("/pedidos");
    return { ok: true, mensaje: "Pedido registrado. No descuenta inventario hasta que se confirme la venta." };
  } catch (error) {
    return aEstadoError(error);
  }
}
