import { z } from "zod";
import type { DependenciasFinanzas } from "@/modules/finanzas/application/finanzas";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioAgricola } from "../domain/puertos";

export interface DependenciasAgricola {
  repo: RepositorioAgricola;
  finanzas: DependenciasFinanzas;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export function validar<T extends z.ZodTypeAny>(esquema: T, entrada: unknown, mensaje: string): z.infer<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
  throw new ErrorValidacion(mensaje, campos);
}

export const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
export const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
export const uuid = z.string().uuid();
export const clave = z.string().min(8).max(100);
export const cantidadTxt = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida (máximo 3 decimales)");
export const montoTxt = z.string().regex(/^\d{1,11}(\.\d{1,2})?$/, "Monto inválido (máximo 2 decimales)");

export function auditar(deps: DependenciasAgricola, ctx: ContextoUsuario, tx: Parameters<Auditor["registrar"]>[1], accion: string, entidad: string, entidadId: string, despues: unknown) {
  return deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion, entidad, entidadId, resultado: "ok", despues, ip: ctx.ip }, tx);
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin depender de la zona horaria del servidor. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}
