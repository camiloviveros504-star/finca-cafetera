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
