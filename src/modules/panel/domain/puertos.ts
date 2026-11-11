import type { Transaccion } from "@/shared/dominio/contexto";

/** Dinero que entró y salió de la finca en el mes en curso. */
export interface Billetera {
  /** Pagos recibidos de compradores. */
  entradas: string;
  /** Gastos (incluidos fletes), pagos a proveedores y pagos a trabajadores. */
  salidas: string;
  saldo: string;
  /** Parte de las salidas que corresponde a fletes. */
  fletes: string;
}

export interface ResumenPanel {
  existencias?: { producto: string; kg: string }[];
  /** Ventas confirmadas del mes en curso. */
  ventasMes?: { cantidad: number; total: string };
  /** Café recolectado en el mes en curso. */
  cosechasMes?: { cantidad: number; kg: string };
  /** Café recolectado en el año por lote (kg), con su estado: café nuevo, zoca o sin sembrar. */
  recoleccionPorLote?: { finca: string; lote: string; estado: string; kg: string }[];
  /** Café recolectado en los últimos 12 meses (kg por mes). */
  recoleccionPorMes?: { mes: string; kg: string }[];
  billeteraMes?: Billetera;
  /** Lo que los compradores todavía deben (ventas confirmadas menos pagos). */
  porCobrar?: { total: string; ventas: number };
  /** Lo que se debe a proveedores y a trabajadores. */
  porPagar?: { proveedores: string; trabajadores: string };
  /** Plagas o enfermedades sin controlar: lotes afectados y cuántos casos son de severidad alta. */
  plagasActivas?: { lotes: number; casos: number; altas: number };
  /** Insumos vencidos o por vencer en 30 días. */
  insumosPorVencer?: number;
  /** Totales de toda la plataforma: solo para quien administra las cuentas. */
  plataforma?: { fincas: number; lotes: number; hectareas: string; usuarios: number; kgAnio: string; kgSeco: string };
}

/** Lado de lectura: indicadores agregados. Solo lee; nunca escribe. */
export interface RepositorioPanel {
  existencias(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ producto: string; kg: string }[]>;
  ventasMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ cantidad: number; total: string }>;
  cosechasMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<{ cantidad: number; kg: string }>;
  recoleccionPorLote(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["recoleccionPorLote"]>>;
  recoleccionPorMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["recoleccionPorMes"]>>;
  billeteraMes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<Billetera>;
  porCobrar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["porCobrar"]>>;
  porPagar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["porPagar"]>>;
  insumosPorVencer(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<number>;
  plagasActivas(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<NonNullable<ResumenPanel["plagasActivas"]>>;
  plataforma(tx: Transaccion, organizacionId: string): Promise<NonNullable<ResumenPanel["plataforma"]>>;
}
