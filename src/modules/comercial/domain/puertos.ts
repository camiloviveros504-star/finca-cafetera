import type { Transaccion } from "@/shared/dominio/contexto";

export interface DetalleVenta {
  id: string;
  productoId: string;
  productoNombre: string;
  loteId: string;
  loteCodigo: string;
  cantidad: string;
  precioUnitario: string;
  subtotal: string;
  tarifaVersionId: string | null;
}

export interface VentaRegistrada {
  id: string;
  numeroComprobante: string;
  fincaId: string;
  clienteId: string;
  clienteNombre: string;
  fecha: string;
  total: string;
  estado: string;
  detalles: DetalleVenta[];
}

export interface FilaVenta {
  id: string;
  numeroComprobante: string;
  fecha: string;
  fincaNombre: string;
  clienteNombre: string;
  total: string;
  estado: string;
}

export interface NuevoDetalle {
  ventaId: string;
  productoId: string;
  loteId: string;
  fincaId: string;
  bodegaId: string;
  cantidad: string;
  precioUnitario: string;
  tarifaVersionId: string;
  subtotal: string;
  movimientoId: string;
}

export interface RepositorioVentas {
  buscarPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<VentaRegistrada | null>;
  clienteExiste(tx: Transaccion, organizacionId: string, clienteId: string): Promise<boolean>;
  /** Inserta el encabezado primero: la clave única serializa los reintentos concurrentes. Lanza ErrorClaveDuplicada. */
  insertarEncabezado(
    tx: Transaccion,
    v: { id: string; organizacionId: string; fincaId: string; clienteId: string; clave: string; creadoPor: string; nota?: string },
  ): Promise<void>;
  insertarDetalle(tx: Transaccion, d: NuevoDetalle): Promise<void>;
  fijarTotal(tx: Transaccion, ventaId: string, total: string): Promise<void>;
  obtener(tx: Transaccion, organizacionId: string, ventaId: string): Promise<VentaRegistrada | null>;
  listar(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
    limite: number,
    desplazamiento: number,
  ): Promise<{ filas: FilaVenta[]; total: number }>;
}
