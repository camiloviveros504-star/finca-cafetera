import type { Transaccion } from "@/shared/dominio/contexto";

export interface CosechaRegistrada {
  id: string;
  fincaId: string;
  loteId: string;
  loteCodigo: string;
  productoNombre: string;
  fecha: string;
  cantidad: string;
  unidadCodigo: string;
  estado: string;
}

export interface NuevaCosecha {
  id: string;
  organizacionId: string;
  fincaId: string;
  loteId: string;
  productoId: string;
  bodegaId: string;
  fecha: string;
  cantidad: string;
  unidadId: string;
  cantidadBase: string;
  factorAplicado: string;
  clave: string;
  capturadaEn: Date;
  registradoPor: string;
  nota?: string;
}

export interface OpcionesRegistro {
  fincas: { id: string; nombre: string }[];
  lotes: { id: string; fincaId: string; codigo: string; nombre: string }[];
  bodegas: { id: string; fincaId: string; nombre: string }[];
  productos: { id: string; codigo: string; nombre: string; unidadId: string }[];
  unidades: { id: string; codigo: string; nombre: string }[];
}

export interface RepositorioProduccion {
  buscarCosechaPorClave(tx: Transaccion, clave: string, organizacionId: string): Promise<CosechaRegistrada | null>;
  loteEsDeFinca(tx: Transaccion, organizacionId: string, loteId: string, fincaId: string): Promise<boolean>;
  bodegaEsDeFinca(tx: Transaccion, organizacionId: string, bodegaId: string, fincaId: string): Promise<boolean>;
  unidadDeProducto(tx: Transaccion, organizacionId: string, productoId: string): Promise<string | null>;
  insertarCosecha(tx: Transaccion, c: NuevaCosecha): Promise<void>;
  obtenerCosecha(tx: Transaccion, id: string): Promise<CosechaRegistrada | null>;
  listarCosechas(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
    limite: number,
    desplazamiento: number,
  ): Promise<{ filas: CosechaRegistrada[]; total: number }>;
  opcionesRegistro(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<OpcionesRegistro>;
}

export interface FilaLote {
  id: string;
  fincaId: string;
  fincaNombre: string;
  codigo: string;
  nombre: string;
  areaHa: string | null;
  variedad: string | null;
  estadoProductivo: string;
  cosechadoKg: string;
}

export interface RepositorioFincasLotes {
  crearFinca(tx: Transaccion, f: { organizacionId: string; nombre: string; ubicacion?: string; areaHa?: string; creadoPor: string }): Promise<string>;
  crearLote(
    tx: Transaccion,
    l: { organizacionId: string; fincaId: string; codigo: string; nombre: string; areaHa?: string; variedad?: string; numeroArboles?: number },
  ): Promise<string>;
  listarFincas(
    tx: Transaccion,
    organizacionId: string,
    fincaIds: readonly string[],
  ): Promise<{ id: string; nombre: string; ubicacion: string | null; areaHa: string | null; lotes: number }[]>;
  listarLotes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaLote[]>;
}
