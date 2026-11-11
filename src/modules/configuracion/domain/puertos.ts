import type { Transaccion } from "@/shared/dominio/contexto";

export interface PrecioVigente {
  valor: string; // numeric(14,2)
  tarifaVersionId: string;
}

export interface RepositorioConfiguracion {
  precioVigente(
    tx: Transaccion,
    organizacionId: string,
    fincaId: string,
    productoId: string,
    fecha: string,
  ): Promise<PrecioVigente | null>;
  /** Factor de conversión vigente (escala 6). Prefiere el de la finca sobre el general. */
  factorConversion(
    tx: Transaccion,
    organizacionId: string,
    fincaId: string,
    origenId: string,
    destinoId: string,
    fecha: string,
  ): Promise<string | null>;
}

export interface FilaTarifa {
  tarifaId: string;
  codigo: string;
  tipo: string;
  productoNombre: string | null;
  unidad: string;
  valorVigente: string | null;
  versionVigente: number | null;
  versiones: number;
  ultimaVersion: number;
  ultimaVigenciaHasta: string | null; // null = sin fin
  ultimaVigenciaDesde: string;
  esDemo: boolean;
}

export interface RepositorioTarifas {
  bloquearTarifa(tx: Transaccion, organizacionId: string, tarifaId: string): Promise<boolean>;
  ultimaVersion(
    tx: Transaccion,
    tarifaId: string,
  ): Promise<{ id: string; version: number; desde: string; hasta: string | null } | null>;
  cerrarVigencia(tx: Transaccion, versionId: string, hasta: string): Promise<void>;
  insertarVersion(
    tx: Transaccion,
    v: { tarifaId: string; version: number; valor: string; desde: string; creadaPor: string },
  ): Promise<string>;
  listar(tx: Transaccion, organizacionId: string, hoy: string): Promise<FilaTarifa[]>;
  historial(
    tx: Transaccion,
    organizacionId: string,
    tarifaId: string,
  ): Promise<{ version: number; valor: string; desde: string; hasta: string | null; creadaEn: string; esDemo: boolean }[]>;
}
