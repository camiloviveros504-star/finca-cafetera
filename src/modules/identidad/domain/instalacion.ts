import type { Transaccion } from "@/shared/dominio/contexto";

export interface DatosInstalacion {
  organizacion: string;
  administrador: { nombre: string; correo: string; hash: string };
}

export interface RepositorioInstalacion {
  hayOrganizacion(tx: Transaccion): Promise<boolean>;
  /**
   * Crea de una vez la organización, su primera finca con bodega, el administrador, los catálogos y los productos
   * básicos del café. No inserta tarifas, precios ni equivalencias: esos valores los define el administrador.
   * Devuelve false si ya existía una organización (otro proceso instaló antes).
   */
  instalar(tx: Transaccion, datos: DatosInstalacion): Promise<{ organizacionId: string; usuarioId: string } | null>;
}
