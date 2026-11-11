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
