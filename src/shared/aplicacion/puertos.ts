import type { Transaccion } from "../dominio/contexto";

export interface UnidadDeTrabajo {
  /** Ejecuta `fn` en una transacción: confirma si termina bien y revierte si falla. */
  ejecutar<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T>;
  /** Ejecuta una consulta de solo lectura. */
  consultar<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T>;
}

export interface EntradaAuditoria {
  organizacionId: string | null;
  usuarioId: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  resultado: "ok" | "denegado" | "error";
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
}

export interface Auditor {
  /** Con `tx` se escribe en la misma transacción que la operación; sin `tx`, de forma independiente. */
  registrar(entrada: EntradaAuditoria, tx?: Transaccion): Promise<void>;
}
