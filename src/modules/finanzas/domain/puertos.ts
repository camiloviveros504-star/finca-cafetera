import type { Transaccion } from "@/shared/dominio/contexto";

export interface FilaProveedor {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  correo: string | null;
  porPagar: string;
}

export interface LineaCompra {
  descripcion: string;
  cantidad: string;
  unidad: string;
  costoUnitario: string;
  subtotal: string;
}

export interface FilaCompra {
  id: string;
  numero: string;
  fecha: string;
  fincaNombre: string;
  proveedorNombre: string;
  estado: "pedida" | "recibida";
  total: string;
  pagado: string;
  saldo: string;
  lineas: LineaCompra[];
}

export interface CompraParaMovimiento {
  id: string;
  fincaId: string;
  estado: string;
  total: string;
  pagado: string;
}

export interface FilaGasto {
  id: string;
  fecha: string;
  fincaNombre: string;
  loteCodigo: string | null;
  tipo: string;
  clasificacion: string;
  descripcion: string;
  monto: string;
}

export interface ResumenFinanciero {
  desde: string;
  hasta: string;
  ingresosVentas: string;
  cobrado: string;
  cuentasPorCobrar: string;
  gastosAgricolas: string;
  gastosAdministrativos: string;
  comprasRecibidas: string;
  manoObraLiquidada: string;
  costosProduccion: string;
  egresosDevengados: string;
  resultadoDevengado: string;
  pagosProveedores: string;
  pagosTrabajadores: string;
  gastosPagados: string;
  flujoDeCaja: string;
  cuentasPorPagarProveedores: string;
  cuentasPorPagarTrabajadores: string;
}

export interface MovimientoFinanciero {
  fecha: string;
  concepto: string;
  tercero: string;
  metodo: string;
  entrada: string;
  salida: string;
}

export interface Conciliacion {
  desde: string;
  hasta: string;
  movimientos: MovimientoFinanciero[];
  porMetodo: { metodo: string; entradas: string; salidas: string; neto: string }[];
  totalEntradas: string;
  totalSalidas: string;
  neto: string;
}

export interface RepositorioFinanzas {
  crearProveedor(tx: Transaccion, p: { organizacionId: string; nombre: string; documento?: string; telefono?: string; correo?: string; autorizaTratamiento: boolean }): Promise<string>;
  listarProveedores(tx: Transaccion, organizacionId: string): Promise<FilaProveedor[]>;
  proveedorExiste(tx: Transaccion, organizacionId: string, proveedorId: string): Promise<boolean>;
  buscarCompraPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarCompra(tx: Transaccion, c: { organizacionId: string; fincaId: string; proveedorId: string; fecha: string; total: string; clave: string; creadoPor: string; nota?: string; lineas: LineaCompra[] }): Promise<string>;
  bloquearCompra(tx: Transaccion, organizacionId: string, compraId: string): Promise<CompraParaMovimiento | null>;
  marcarRecibida(tx: Transaccion, compraId: string, fecha: string, usuarioId: string): Promise<void>;
  buscarPagoProveedorPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarPagoProveedor(tx: Transaccion, p: { organizacionId: string; compraId: string; monto: string; metodo: string; fecha: string; clave: string; registradoPor: string }): Promise<string>;
  metodoExiste(tx: Transaccion, organizacionId: string, codigo: string): Promise<boolean>;
  tipoGastoExiste(tx: Transaccion, organizacionId: string, codigo: string): Promise<boolean>;
  loteEsDeFinca(tx: Transaccion, organizacionId: string, loteId: string, fincaId: string): Promise<boolean>;
  listarCompras(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaCompra[]>;
  buscarGastoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarGasto(tx: Transaccion, g: { organizacionId: string; fincaId: string; loteId?: string; tipo: string; clasificacion: string; fecha: string; descripcion: string; monto: string; metodo?: string; clave: string; registradoPor: string }): Promise<string>;
  listarGastos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], desde: string, hasta: string): Promise<FilaGasto[]>;
  resumen(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], desde: string, hasta: string): Promise<ResumenFinanciero>;
  conciliacion(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], desde: string, hasta: string): Promise<Conciliacion>;
}
