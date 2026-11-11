import type { Transaccion } from "@/shared/dominio/contexto";

export interface ResumenPanel {
  existencias?: { producto: string; kg: string }[];
  ventas30d?: { cantidad: number; total: string };
  cosechas30d?: { cantidad: number; kg: string };
  movimientos30d?: number;
  /** Café recolectado en el año por lote (kg), con su estado: café nuevo, zoca o sin sembrar. */
  recoleccionPorLote?: { finca: string; lote: string; estado: string; kg: string }[];
  /** Café recolectado en los últimos 12 meses (kg por mes). */
  recoleccionPorMes?: { mes: string; kg: string }[];
  /** Gastos de los últimos 30 días, con el total de fletes aparte. */
  gastos30d?: { total: string; fletes: string };
  /** Lo que los compradores todavía deben (ventas confirmadas menos pagos). */
  porCobrar?: { total: string; ventas: number };
  /** Lo que se debe a proveedores y a trabajadores. */
  porPagar?: { proveedores: string; trabajadores: string };
  /** Insumos vencidos o por vencer en 30 días. */
  insumosPorVencer?: number;
  /** Totales de toda la plataforma: solo para quien administra las cuentas. */
  plataforma?: { fincas: number; lotes: number; hectareas: string; usuarios: number; kgAnio: string; kgSeco: string };
}

/** Lado de lectura: indicadores agregados. Solo lee; nunca escribe. */
export interface RepositorioPanel {
  existencias(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ producto: string; kg: string }[]>;
  ventas30d(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ cantidad: number; total: string }>;
  cosechas30d(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ cantidad: number; kg: string }>;
  recoleccionPorLote(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["recoleccionPorLote"]>>;
  recoleccionPorMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["recoleccionPorMes"]>>;
  gastos30d(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["gastos30d"]>>;
  porCobrar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["porCobrar"]>>;
  porPagar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["porPagar"]>>;
  insumosPorVencer(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<number>;
  plataforma(tx: Transaccion, organizacionId: string): Promise<NonNullable<ResumenPanel["plataforma"]>>;
}
