"use server";

import { revalidatePath } from "next/cache";
import { agregarFincaAPropietario, altaDeFinca, invitarUsuario, servicios } from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { formatoVencimiento, urlDeActivacion } from "../../_servidor/enlaces";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const RUTAS = ["/fincas", "/usuarios", "/inicio"];

/**
 * Nueva finca: para un propietario que ya existe (su segunda, tercera… finca) o para uno nuevo, que recibe su enlace.
 * La casilla “Es un propietario nuevo” decide cuál de los dos; sin propietario, la finca queda para asignarla después.
 */
export async function accionAltaFinca(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const nuevo = d.get("propietarioNuevo") === "on";
    const r = await altaDeFinca(servicios(), ctx, {
      nombre: t(d, "nombre"), ubicacion: t(d, "ubicacion"), areaHa: t(d, "areaHa").replace(",", "."),
      propietarioId: nuevo ? undefined : t(d, "propietarioId"),
      propietarioNombre: nuevo ? t(d, "propietarioNombre") : undefined, propietarioCorreo: nuevo ? t(d, "propietarioCorreo") : undefined,
    });
    for (const ruta of RUTAS) revalidatePath(ruta);
    if (r.invitacion) return { ok: true, mensaje: `Finca creada y cuenta de ${r.propietario} registrada. Entréguele el enlace para que cree su contraseña.`, enlace: await urlDeActivacion(r.invitacion.token), enlaceVence: formatoVencimiento(r.invitacion.expiraEn) };
    if (r.propietario) return { ok: true, mensaje: `Finca creada y asignada a ${r.propietario}. Ya puede registrar sus lotes.` };
    return { ok: true, mensaje: "Finca creada sin propietario. Asígnelo desde “Fincas sin propietario”." };
  } catch (error) {
    return aEstadoError(error);
  }
}

/** Asigna una finca existente a un propietario que ya tiene cuenta. */
export async function accionAsignarFinca(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    await agregarFincaAPropietario(servicios().usuarios, ctx, { usuarioId: t(d, "propietarioId"), fincaId: t(d, "fincaId") });
    for (const ruta of RUTAS) revalidatePath(ruta);
    return { ok: true, mensaje: "Finca asignada." };
  } catch (error) {
    return aEstadoError(error);
  }
}

/** Registra un propietario nuevo para una finca que ya existe (por ejemplo, un socio). */
export async function accionAgregarPropietario(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await invitarUsuario(servicios().invitaciones, ctx, { nombre: t(d, "nombre"), correo: t(d, "correo"), roles: ["propietario"], fincaIds: [t(d, "fincaId")] });
    for (const ruta of RUTAS) revalidatePath(ruta);
    return { ok: true, mensaje: "Propietario registrado. Entréguele el enlace para que cree su contraseña.", enlace: await urlDeActivacion(r.token), enlaceVence: formatoVencimiento(r.expiraEn) };
  } catch (error) {
    return aEstadoError(error);
  }
}
