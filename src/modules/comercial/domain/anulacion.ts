import type { Transaccion } from "@/shared/dominio/contexto";

export interface VentaParaAnular {
  id: string;
  fincaId: string;
  estado: string;
  pagado: string;
  total: string;
}

export interface RepositorioAnulacionVenta {
  bloquearVenta(tx: Transaccion, organizacionId: string, ventaId: string): Promise<VentaParaAnular | null>;
  /** Movimientos de salida de la venta, en orden determinista (lote, bodega, producto) para evitar bloqueos mutuos. */
  movimientosDeVenta(tx: Transaccion, ventaId: string): Promise<string[]>;
  marcarAnulada(tx: Transaccion, ventaId: string, usuarioId: string, motivo: string): Promise<void>;
}
