import type { Transaccion } from "@/shared/dominio/contexto";

export interface ResumenPanel {
  existencias?: { producto: string; kg: string }[];
  ventas30d?: { cantidad: number; total: string };
  cosechas30d?: { cantidad: number; kg: string };
  movimientos30d?: number;
}

/** Lado de lectura: indicadores agregados. Solo lee; nunca escribe. */
export interface RepositorioPanel {
  existencias(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ producto: string; kg: string }[]>;
  ventas30d(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ cantidad: number; total: string }>;
  cosechas30d(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ cantidad: number; kg: string }>;
}
