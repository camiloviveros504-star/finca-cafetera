"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { activarCuenta, cerrarSesion, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { ipDeSolicitud, NOMBRE_COOKIE } from "../../_servidor/sesion";

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
  // Si en este navegador había otra sesión abierta (por ejemplo, la del administrador que generó el enlace), se cierra:
  // quien acaba de activar su cuenta debe entrar con ella, no seguir dentro de la cuenta de otro.
  const almacen = await cookies();
  const abierta = almacen.get(NOMBRE_COOKIE)?.value;
  if (abierta) {
    await cerrarSesion(servicios().sesion, abierta);
    almacen.delete(NOMBRE_COOKIE);
  }
  redirect(`/login?cuenta=${tipo === "alta" ? "activada" : "restablecida"}`);
}
