"use server";

import { redirect } from "next/navigation";
import { activarCuenta, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { ipDeSolicitud } from "../../_servidor/sesion";

/** La persona fija su propia contraseña con el enlace que le entregó el administrador. */
export async function accionActivar(_previo: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const t = (k: string) => String(d.get(k) ?? "");
  let tipo: string;
  try {
    const r = await activarCuenta(servicios().invitaciones, {
      token: t("token"), contrasena: t("contrasena"), confirmacion: t("confirmacion"), aceptaTratamiento: d.get("acepta") === "on", ip: await ipDeSolicitud(),
    });
    tipo = r.tipo;
  } catch (error) {
    return aEstadoError(error);
  }
  redirect(`/login?cuenta=${tipo === "alta" ? "activada" : "restablecida"}`);
}
