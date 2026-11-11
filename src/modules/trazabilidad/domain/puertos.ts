import type { Transaccion } from "@/shared/dominio/contexto";

export interface TrazaCosecha {
  cosechaId: string;
  fecha: string;
  cantidad: string;
  unidad: string;
}

export interface TrazaTransformacion {
  transformacionId: string;
  tipo: string;
  fecha: string;
  productoEntrada: string;
  productoSalida: string;
  cantidadEntrada: string;
  cantidadSalida: string;
}

export interface TrazaLinea {
  producto: string;
  loteId: string;
  loteCodigo: string;
  loteNombre: string;
  fincaNombre: string;
  cantidadVendida: string;
  movimientoId: string;
  transformaciones: TrazaTransformacion[];
  cosechas: TrazaCosecha[];
}

export interface Trazabilidad {
  ventaId: string;
  numeroComprobante: string;
  fecha: string;
  cliente: string;
  lineas: TrazaLinea[];
}

/** Consulta de solo lectura (lado de lectura): une varias tablas para reconstruir venta → lote → cosechas. */
export interface RepositorioTrazabilidad {
  porVenta(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], ventaId: string): Promise<Trazabilidad | null>;
}
