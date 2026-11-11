"use server";

import { redirect } from "next/navigation";
import { instalarSistema, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../_servidor/errores";

/** Crea la organización y el primer administrador (solo si la base está vacía y el código de instalación es correcto). */
export async function accionInstalar(_previo: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const t = (k: string) => String(d.get(k) ?? "");
  try {
    await instalarSistema(servicios().instalacion, {
      codigo: t("codigo"), organizacion: t("organizacion"), finca: t("finca"), nombre: t("nombre"), correo: t("correo"),
      contrasena: t("contrasena"), autorizaTratamiento: d.get("autoriza") === "on",
    });
  } catch (error) {
    return aEstadoError(error);
  }
  redirect("/login?instalado=1");
}
