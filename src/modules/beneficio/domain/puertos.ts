import type { Transaccion } from "@/shared/dominio/contexto";

export interface EtapaProceso {
  id: string;
  orden: number;
  codigo: string;
  nombre: string;
  productoEntradaId: string;
  productoEntradaNombre: string;
  productoSalidaId: string;
  productoSalidaNombre: string;
  mermaEsperadaPct: string | null;
}

export interface FilaProceso {
  id: string;
  codigo: string;
  nombre: string;
  esDemo: boolean;
  etapas: EtapaProceso[];
}

export interface EtapaParaEjecutar extends EtapaProceso {
  procesoTipoId: string;
  procesoNombre: string;
}

export interface FilaRegistroProceso {
  id: string;
  fecha: string;
  fincaNombre: string;
  procesoNombre: string;
  etapaNombre: string;
  entradaTotal: string;
  salidaTotal: string;
  perdidaTotal: string;
  mermaPct: string;
  mermaExcede: boolean;
  justificacion: string | null;
  responsable: string;
  transformacionId: string;
}

export interface RepositorioBeneficio {
  crearProceso(tx: Transaccion, p: { organizacionId: string; codigo: string; nombre: string; creadoPor: string; etapas: { codigo: string; nombre: string; productoEntradaId: string; productoSalidaId: string; mermaEsperadaPct?: string }[] }): Promise<string>;
  productosExisten(tx: Transaccion, organizacionId: string, ids: string[]): Promise<boolean>;
  listarProcesos(tx: Transaccion, organizacionId: string): Promise<FilaProceso[]>;
  obtenerEtapa(tx: Transaccion, organizacionId: string, etapaId: string): Promise<EtapaParaEjecutar | null>;
  registroPorTransformacion(tx: Transaccion, transformacionId: string): Promise<string | null>;
  insertarRegistro(tx: Transaccion, r: { organizacionId: string; fincaId: string; procesoTipoId: string; etapaId: string; transformacionId: string; fecha: string; entradaTotal: string; salidaTotal: string; perdidaTotal: string; mermaPct: string; excede: boolean; justificacion?: string; responsableId: string }): Promise<string>;
  listarRegistros(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], limite: number): Promise<FilaRegistroProceso[]>;
}
