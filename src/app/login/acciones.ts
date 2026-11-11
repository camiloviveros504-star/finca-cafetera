"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cerrarSesion, iniciarSesion, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../_servidor/errores";
import { ipDeSolicitud, NOMBRE_COOKIE } from "../_servidor/sesion";

export async function accionIniciarSesion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  try {
    const sesion = await iniciarSesion(servicios().sesion, {
      correo: String(datos.get("correo") ?? ""),
      contrasena: String(datos.get("contrasena") ?? ""),
      ip: await ipDeSolicitud(),
    });
    (await cookies()).set(NOMBRE_COOKIE, sesion.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: sesion.expiraEn,
    });
  } catch (error) {
    return aEstadoError(error);
  }
  redirect("/inicio");
}

export async function accionCerrarSesion(): Promise<void> {
  const almacen = await cookies();
  await cerrarSesion(servicios().sesion, almacen.get(NOMBRE_COOKIE)?.value);
  almacen.delete(NOMBRE_COOKIE);
  redirect("/login");
}
