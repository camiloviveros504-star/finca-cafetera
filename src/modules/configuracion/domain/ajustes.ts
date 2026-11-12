import type { Transaccion } from "@/shared/dominio/contexto";

/** Catálogos que usa la operación: con qué se paga y en qué se gasta. */
export const CATALOGOS = ["metodo_pago", "tipo_gasto"] as const;
export type Catalogo = (typeof CATALOGOS)[number];

/** Parámetros operativos de cada finca. El valor y su rango se validan; ninguno está fijo en el código. */
export const PARAMETROS = {
  arboles_por_hectarea: { descripcion: "Árboles por hectárea sugeridos al sembrar un lote (referencia Cenicafé: unos 5.000)", min: 500, max: 20000 },
  descuento_maximo_pct: { descripcion: "Descuento máximo que se permite en una venta (%)", min: 0, max: 100 },
} as const;
export type ClaveParametro = keyof typeof PARAMETROS;

/** Un valor de catálogo: base del sistema (sin finca, no editable) o propio de una finca. */
export interface ValorCatalogo { id: string; catalogo: string; codigo: string; nombre: string; activo: boolean; fincaId: string | null; fincaNombre: string | null }
export interface Equivalencia {
  id: string; fincaId: string | null; fincaNombre: string | null; origen: string; destino: string; factor: string; desde: string; hasta: string | null; esDemo: boolean; vigente: boolean;
}
export interface ParametroConfigurado { clave: string; valor: string; fincaId: string | null; fincaNombre: string | null; actualizadoEn: string }

export interface RepositorioAjustes {
  /** Base del sistema más los valores de las fincas indicadas. */
  listarCatalogos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<ValorCatalogo[]>;
  /** ¿Ya existe ese código como valor base o en esa finca? */
  codigoEnUso(tx: Transaccion, organizacionId: string, catalogo: string, codigo: string, fincaId: string): Promise<boolean>;
  crearValorCatalogo(tx: Transaccion, v: { organizacionId: string; fincaId: string; catalogo: string; codigo: string; nombre: string }): Promise<string>;
  /** Solo valores propios de alguna de esas fincas; los valores base no se tocan. */
  cambiarEstadoValor(tx: Transaccion, organizacionId: string, id: string, activo: boolean, fincaIds: readonly string[]): Promise<boolean>;
  listarEquivalencias(tx: Transaccion, organizacionId: string, hoy: string, fincaIds: readonly string[]): Promise<Equivalencia[]>;
  unidadId(tx: Transaccion, codigo: string): Promise<{ id: string; tipo: string } | null>;
  ultimaEquivalencia(tx: Transaccion, organizacionId: string, fincaId: string | null, origenId: string, destinoId: string): Promise<{ id: string; desde: string; hasta: string | null } | null>;
  cerrarEquivalencia(tx: Transaccion, id: string, hasta: string): Promise<void>;
  insertarEquivalencia(tx: Transaccion, e: { organizacionId: string; fincaId: string | null; origenId: string; destinoId: string; factor: string; desde: string; creadaPor: string }): Promise<string>;
  listarParametros(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<ParametroConfigurado[]>;
  guardarParametro(tx: Transaccion, p: { organizacionId: string; fincaId: string | null; clave: string; valor: string; usuarioId: string }): Promise<{ anterior: string | null }>;
  obtenerParametro(tx: Transaccion, organizacionId: string, fincaId: string, clave: string): Promise<string | null>;
}
