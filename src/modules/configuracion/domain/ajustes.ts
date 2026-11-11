import type { Transaccion } from "@/shared/dominio/contexto";

export const CATALOGOS = ["metodo_pago", "tipo_gasto", "tipo_cafe", "categoria_producto", "estado_operativo"] as const;
export type Catalogo = (typeof CATALOGOS)[number];

/** Parámetros operativos permitidos. El valor y su rango se validan; ninguno está fijo en el código. */
export const PARAMETROS = {
  descuento_maximo_pct: { descripcion: "Descuento máximo autorizado en una venta (%)", min: 0, max: 100 },
  stock_minimo_kg: { descripcion: "Existencias mínimas por producto antes de alertar (kg)", min: 0, max: 1_000_000 },
} as const;
export type ClaveParametro = keyof typeof PARAMETROS;

export interface ValorCatalogo { id: string; catalogo: string; codigo: string; nombre: string; activo: boolean }
export interface Equivalencia {
  id: string; fincaId: string | null; fincaNombre: string | null; origen: string; destino: string; factor: string; desde: string; hasta: string | null; esDemo: boolean; vigente: boolean;
}
export interface Temporada { id: string; nombre: string; desde: string; hasta: string }
export interface ParametroConfigurado { clave: string; valor: string; fincaId: string | null; fincaNombre: string | null; actualizadoEn: string }

export interface RepositorioAjustes {
  listarCatalogos(tx: Transaccion, organizacionId: string): Promise<ValorCatalogo[]>;
  crearValorCatalogo(tx: Transaccion, v: { organizacionId: string; catalogo: string; codigo: string; nombre: string }): Promise<string>;
  cambiarEstadoValor(tx: Transaccion, organizacionId: string, id: string, activo: boolean): Promise<boolean>;
  listarEquivalencias(tx: Transaccion, organizacionId: string, hoy: string): Promise<Equivalencia[]>;
  unidadId(tx: Transaccion, codigo: string): Promise<{ id: string; tipo: string } | null>;
  ultimaEquivalencia(tx: Transaccion, organizacionId: string, fincaId: string | null, origenId: string, destinoId: string): Promise<{ id: string; desde: string; hasta: string | null } | null>;
  cerrarEquivalencia(tx: Transaccion, id: string, hasta: string): Promise<void>;
  insertarEquivalencia(tx: Transaccion, e: { organizacionId: string; fincaId: string | null; origenId: string; destinoId: string; factor: string; desde: string; creadaPor: string }): Promise<string>;
  listarTemporadas(tx: Transaccion, organizacionId: string): Promise<Temporada[]>;
  insertarTemporada(tx: Transaccion, t: { organizacionId: string; nombre: string; desde: string; hasta: string }): Promise<string>;
  listarParametros(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<ParametroConfigurado[]>;
  guardarParametro(tx: Transaccion, p: { organizacionId: string; fincaId: string | null; clave: string; valor: string; usuarioId: string }): Promise<{ anterior: string | null }>;
  obtenerParametro(tx: Transaccion, organizacionId: string, fincaId: string, clave: string): Promise<string | null>;
}
