/**
 * Derechos del titular sobre los datos de un cliente (Ley 1581 de 2012; Decreto 1377 de 2013, compilado en el Decreto
 * 1074 de 2015): conocer (exportación), rectificar y suprimir. La supresión anonimiza los campos personales y conserva
 * el registro para que ventas, pagos y trazabilidad sigan siendo consistentes. Todo queda en la auditoría, sin copiar
 * los datos personales en ella.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioDerechosCliente } from "../domain/derechos";

export interface DependenciasDerechosCliente {
  repo: RepositorioDerechosCliente;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export async function exportarDatosCliente(deps: DependenciasDerechosCliente, ctx: ContextoUsuario, clienteId: string) {
  await autorizar(deps.auditor, ctx, "datos_personales:gestionar", { accion: "cliente.exportar", entidad: "cliente" });
  return deps.uow.ejecutar(async (tx) => {
    const c = await deps.repo.obtener(tx, ctx.organizacionId, clienteId);
    if (!c) throw new ErrorNoEncontrado("Cliente");
    const resumen = await deps.repo.resumenComercial(tx, ctx.organizacionId, clienteId);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "cliente.exportar", entidad: "cliente", entidadId: clienteId, resultado: "ok", ip: ctx.ip }, tx);
    return {
      generadoEn: new Date().toISOString(),
      responsable: "Titular de la organización (responsable del tratamiento)",
      finalidad: c.finalidad,
      titular: { nombre: c.nombre, documento: c.documento, telefono: c.telefono, correo: c.correo, direccion: c.direccion },
      autorizacionEn: c.autorizoEn,
      anonimizadoEn: c.anonimizadoEn,
      resumenComercial: resumen,
    };
  });
}

const esquemaRectificar = z.object({
  clienteId: z.string().uuid(),
  nombre: z.string().trim().min(3, "Indique el nombre").max(120).optional(),
  telefono: z.preprocess(vacio, z.string().trim().max(20).nullable().optional()),
  correo: z.preprocess(vacio, z.string().trim().email("Correo inválido").max(120).nullable().optional()),
  direccion: z.preprocess(vacio, z.string().trim().max(200).nullable().optional()),
});

export async function rectificarCliente(deps: DependenciasDerechosCliente, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquemaRectificar.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos a rectificar", campos);
  }
  const { clienteId, ...campos } = r.data;
  await autorizar(deps.auditor, ctx, "cliente:administrar", { accion: "cliente.rectificar", entidad: "cliente" });
  return deps.uow.ejecutar(async (tx) => {
    const actual = await deps.repo.obtener(tx, ctx.organizacionId, clienteId);
    if (!actual) throw new ErrorNoEncontrado("Cliente");
    if (actual.anonimizadoEn) throw new ErrorRegla("Los datos de este cliente fueron suprimidos y no se pueden modificar", "cliente_anonimizado");
    await deps.repo.actualizar(tx, ctx.organizacionId, clienteId, campos);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "cliente.rectificar", entidad: "cliente", entidadId: clienteId, resultado: "ok", despues: { camposModificados: Object.keys(campos).filter((k) => (campos as Record<string, unknown>)[k] !== undefined) }, ip: ctx.ip }, tx);
    return { ok: true };
  });
}

export async function anonimizarCliente(deps: DependenciasDerechosCliente, ctx: ContextoUsuario, cruda: unknown) {
  const e = z.object({ clienteId: z.string().uuid(), motivo: z.string().trim().min(10, "Indique el motivo de la solicitud (mínimo 10 caracteres)").max(300) }).safeParse(cruda);
  if (!e.success) throw new ErrorValidacion("Revise los datos de la supresión", { motivo: e.error.issues[0]?.message ?? "Inválido" });
  await autorizar(deps.auditor, ctx, "datos_personales:gestionar", { accion: "cliente.anonimizar", entidad: "cliente" });
  return deps.uow.ejecutar(async (tx) => {
    const actual = await deps.repo.obtener(tx, ctx.organizacionId, e.data.clienteId);
    if (!actual) throw new ErrorNoEncontrado("Cliente");
    if (actual.anonimizadoEn) throw new ErrorRegla("Los datos de este cliente ya fueron suprimidos", "cliente_anonimizado");
    await deps.repo.anonimizar(tx, ctx.organizacionId, e.data.clienteId);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "cliente.anonimizar", entidad: "cliente", entidadId: e.data.clienteId, resultado: "ok", despues: { motivo: e.data.motivo }, ip: ctx.ip }, tx);
    return { ok: true };
  });
}

export type { DatosCliente } from "../domain/derechos";
