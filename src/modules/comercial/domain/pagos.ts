import type { Transaccion } from "@/shared/dominio/contexto";

export interface VentaParaPago {
  id: string;
  fincaId: string;
  estado: string;
  total: string;
  pagado: string;
}

export interface FilaCartera {
  ventaId: string;
  comprobante: string;
  fecha: string;
  cliente: string;
  fincaNombre: string;
  total: string;
  pagado: string;
  saldo: string;
  diasAntiguedad: number;
}

export interface RepositorioPagosClientes {
  bloquearVenta(tx: Transaccion, organizacionId: string, ventaId: string): Promise<VentaParaPago | null>;
  buscarPagoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  metodoExiste(tx: Transaccion, organizacionId: string, codigo: string, fincaIds: readonly string[]): Promise<boolean>;
  insertarPago(tx: Transaccion, p: { organizacionId: string; ventaId: string; monto: string; metodo: string; fecha: string; clave: string; registradoPor: string }): Promise<string>;
  listarCartera(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloPendiente: boolean): Promise<FilaCartera[]>;
}
