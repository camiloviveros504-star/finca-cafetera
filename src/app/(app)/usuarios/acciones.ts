"use server";

import { revalidatePath } from "next/cache";
import {
  emitirEnlace, invitarUsuario, vincularUsuarioATrabajador,
  asignarRolesYFincas, cambiarEstadoUsuario, cambiarEstadoValorCatalogo, cambiarPermisoExtra, crearEquivalencia, crearTemporada, crearUsuario, crearValorCatalogo,
  guardarParametro, restablecerContrasena, servicios,
} from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { formatoVencimiento, urlDeActivacion } from "../../_servidor/enlaces";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "");
const todos = (d: FormData, k: string) => d.getAll(k).map(String);
const dec = (d: FormData, k: string) => t(d, k).replace(",", ".");

async function ejecutar(rutas: string[], mensaje: string, fn: () => Promise<unknown>): Promise<EstadoFormulario> {
  try {
    await fn();
    for (const r of rutas) revalidatePath(r);
    return { ok: true, mensaje };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionCrearUsuario(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/usuarios"], "Usuario creado.", () =>
    crearUsuario(servicios().usuarios, ctx, { correo: t(d, "correo"), nombre: t(d, "nombre"), contrasena: t(d, "contrasena"), roles: todos(d, "roles"), fincaIds: todos(d, "fincaIds"), autorizaTratamiento: d.get("autoriza") === "on" }),
  );
}

export async function accionAsignar(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/usuarios"], "Roles y fincas actualizados. Se cerraron las sesiones del usuario.", () =>
    asignarRolesYFincas(servicios().usuarios, ctx, { usuarioId: t(d, "usuarioId"), roles: todos(d, "roles"), fincaIds: todos(d, "fincaIds") }),
  );
}

export async function accionEstadoUsuario(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/usuarios"], "Estado actualizado.", () => cambiarEstadoUsuario(servicios().usuarios, ctx, { usuarioId: t(d, "usuarioId"), activo: t(d, "activo") === "si" }));
}

export async function accionContrasena(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/usuarios"], "Contraseña restablecida.", () => restablecerContrasena(servicios().usuarios, ctx, { usuarioId: t(d, "usuarioId"), contrasena: t(d, "contrasena") }));
}

export async function accionPermisoExtra(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/usuarios"], "Permiso actualizado.", () => cambiarPermisoExtra(servicios().usuarios, ctx, { usuarioId: t(d, "usuarioId"), permiso: t(d, "permiso"), otorgar: t(d, "accion") === "otorgar" }));
}

export async function accionValorCatalogo(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/configuracion/general"], "Valor creado.", () => crearValorCatalogo(servicios().ajustes, ctx, { catalogo: t(d, "catalogo"), codigo: t(d, "codigo"), nombre: t(d, "nombre") }));
}

export async function accionEstadoValor(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/configuracion/general"], "Estado actualizado.", () => cambiarEstadoValorCatalogo(servicios().ajustes, ctx, { id: t(d, "id"), activo: t(d, "activo") === "si" }));
}

export async function accionEquivalencia(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/configuracion/general"], "Equivalencia creada con su vigencia.", () =>
    crearEquivalencia(servicios().ajustes, ctx, { fincaId: t(d, "fincaId"), origen: t(d, "origen"), destino: t(d, "destino"), factor: dec(d, "factor"), desde: t(d, "desde") }),
  );
}

export async function accionTemporada(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/configuracion/general"], "Temporada creada.", () => crearTemporada(servicios().ajustes, ctx, { nombre: t(d, "nombre"), desde: t(d, "desde"), hasta: t(d, "hasta") }));
}

export async function accionParametro(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/configuracion/general"], "Parámetro guardado.", () => guardarParametro(servicios().ajustes, ctx, { clave: t(d, "clave"), valor: dec(d, "valor"), fincaId: t(d, "fincaId") }));
}

/** El administrador registra a la persona y define sus roles; el sistema entrega un enlace para que ella fije su contraseña. */
export async function accionInvitar(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await invitarUsuario(servicios().invitaciones, ctx, { correo: t(d, "correo"), nombre: t(d, "nombre"), roles: todos(d, "roles"), fincaIds: todos(d, "fincaIds") });
    const trabajadorId = t(d, "trabajadorId");
    if (trabajadorId) await vincularUsuarioATrabajador(servicios().talento, ctx, { trabajadorId, usuarioId: r.usuarioId });
    revalidatePath("/usuarios");
    return { ok: true, mensaje: "Usuario registrado. Aún no puede ingresar: debe activar su cuenta con el enlace.", enlace: await urlDeActivacion(r.token), enlaceVence: formatoVencimiento(r.expiraEn) };
  } catch (error) {
    return aEstadoError(error);
  }
}

/** Alta pendiente: enlace nuevo (el anterior deja de servir). Cuenta activa: enlace para restablecer la contraseña. */
export async function accionEmitirEnlace(_p: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const ctx = await exigirContexto();
  try {
    const r = await emitirEnlace(servicios().invitaciones, ctx, { usuarioId: t(d, "usuarioId") });
    revalidatePath("/usuarios");
    return { ok: true, mensaje: r.tipo === "alta" ? "Enlace de activación generado; el anterior ya no sirve." : "Enlace de restablecimiento generado; el anterior ya no sirve.", enlace: await urlDeActivacion(r.token), enlaceVence: formatoVencimiento(r.expiraEn) };
  } catch (error) {
    return aEstadoError(error);
  }
}
