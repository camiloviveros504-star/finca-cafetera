"use server";

import { revalidatePath } from "next/cache";
import { altaDeFinca, invitarUsuario, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { formatoVencimiento, urlDeActivacion } from "../../_servidor/enlaces";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

/** Alta de una finca y, si se indica, de su propietario: en un solo paso. */
export async function accionAltaFinca(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await altaDeFinca(servicios(), ctx, {
      nombre: t(d, "nombre"), ubicacion: t(d, "ubicacion"), areaHa: t(d, "areaHa").replace(",", "."),
      propietarioNombre: t(d, "propietarioNombre"), propietarioCorreo: t(d, "propietarioCorreo"),
    });
    revalidatePath("/fincas");
    if (!r.invitacion) return { ok: true, mensaje: "Finca creada con su bodega principal. Aún no tiene propietario: agréguelo desde su tarjeta." };
    return { ok: true, mensaje: "Finca creada y propietario registrado. Entréguele el enlace para que cree su contraseña.", enlace: await urlDeActivacion(r.invitacion.token), enlaceVence: formatoVencimiento(r.invitacion.expiraEn) };
  } catch (error) {
    return aEstadoError(error);
  }
}

/** Agrega otro propietario (o administrador de finca) a una finca que ya existe. */
export async function accionAgregarPropietario(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await invitarUsuario(servicios().invitaciones, ctx, { nombre: t(d, "nombre"), correo: t(d, "correo"), roles: ["propietario"], fincaIds: [t(d, "fincaId")] });
    revalidatePath("/fincas");
    revalidatePath("/usuarios");
    return { ok: true, mensaje: "Propietario registrado. Entréguele el enlace para que cree su contraseña.", enlace: await urlDeActivacion(r.token), enlaceVence: formatoVencimiento(r.expiraEn) };
  } catch (error) {
    return aEstadoError(error);
  }
}
