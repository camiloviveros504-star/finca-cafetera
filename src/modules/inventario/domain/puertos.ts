import type { Transaccion } from "@/shared/dominio/contexto";
import type { SaldoCandidato } from "./asignacion";

export interface FiltroSaldos {
  organizacionId: string;
  fincaId: string;
  productoId: string;
  loteId?: string;
  bodegaId?: string;
  soloVendible: boolean;
}

export interface NuevoMovimiento {
  organizacionId: string;
  fincaId: string;
  bodegaId: string;
  productoId: string;
  loteId: string;
  tipo: string;
  delta: string; // decimal con signo
  origenTipo: string;
  origenId: string | null;
  revierteA?: string | null;
  creadoPor: string;
  nota?: string | null;
}

export interface FilaSaldo {
  saldoId: string;
  fincaId: string;
  fincaNombre: string;
  bodegaNombre: string;
  productoCodigo: string;
  productoNombre: string;
  loteCodigo: string;
  cantidad: string;
}

export interface RepositorioInventario {
  /** Bloquea (FOR UPDATE) los saldos candidatos en orden determinista. */
  bloquearSaldos(tx: Transaccion, filtro: FiltroSaldos): Promise<SaldoCandidato[]>;
  descontarSaldo(tx: Transaccion, saldoId: string, cantidad: string): Promise<void>;
  /** Suma al saldo (lo crea si no existe) y devuelve el nuevo saldo. */
  acreditarSaldo(
    tx: Transaccion,
    s: { organizacionId: string; fincaId: string; bodegaId: string; productoId: string; loteId: string; cantidad: string },
  ): Promise<void>;
  insertarMovimiento(tx: Transaccion, m: NuevoMovimiento): Promise<string>;
  listarSaldos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], fincaId?: string): Promise<FilaSaldo[]>;
}

export interface SaldoExacto {
  id: string;
  cantidad: string;
}

export interface Ubicacion {
  fincaId: string;
  bodegaId: string;
  productoId: string;
  loteId: string;
}

export interface MovimientoRegistrado {
  id: string;
  tipo: string;
  delta: string;
  origenTipo: string;
  origenId: string | null;
  revierteA: string | null;
  fincaId: string;
  bodegaId: string;
  productoId: string;
  loteId: string;
  creadoEn: string;
}

export interface FilaMovimiento {
  id: string;
  fecha: string;
  tipo: string;
  delta: string;
  producto: string;
  lote: string;
  bodega: string;
  finca: string;
  origenTipo: string;
  nota: string | null;
  reversible: boolean;
}

export interface NuevaTransformacion {
  id: string;
  organizacionId: string;
  fincaId: string;
  bodegaId: string;
  tipo: string;
  fecha: string;
  factorRendimiento: string | null;
  clave: string;
  creadoPor: string;
  nota?: string;
}

export interface LineaTransformacion {
  transformacionId: string;
  fincaId: string;
  loteId: string;
  productoEntradaId: string;
  productoSalidaId: string;
  cantidadEntrada: string;
  cantidadSalida: string;
  cantidadPerdida: string;
}

/** Operaciones adicionales del inventario (ajustes, traslados, transformaciones, reversos). */
export interface RepositorioOperacionesInventario {
  ubicacionValida(tx: Transaccion, organizacionId: string, u: Ubicacion): Promise<boolean>;
  bloquearSaldoExacto(tx: Transaccion, u: { bodegaId: string; productoId: string; loteId: string }): Promise<SaldoExacto | null>;
  buscarMovimientoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<MovimientoRegistrado | null>;
  obtenerMovimiento(tx: Transaccion, organizacionId: string, id: string): Promise<MovimientoRegistrado | null>;
  insertarMovimientoConClave(tx: Transaccion, m: NuevoMovimiento & { clave: string | null }): Promise<string>;
  insertarTransformacion(tx: Transaccion, t: NuevaTransformacion): Promise<void>;
  insertarLineaTransformacion(tx: Transaccion, l: LineaTransformacion): Promise<void>;
  transformacionPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  listarMovimientos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], limite: number, desplazamiento: number): Promise<{ filas: FilaMovimiento[]; total: number }>;
  yaReversado(tx: Transaccion, movimientoId: string): Promise<boolean>;
}
