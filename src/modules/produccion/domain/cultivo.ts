import type { Transaccion } from "@/shared/dominio/contexto";

export type EtapaCultivo = "sin_sembrar" | "levante" | "produccion" | "renovacion";

export interface EventoLote { id: string; fecha: string; tipo: string; arboles: number | null; detalle: string | null }

export interface Recomendacion {
  id: string; etapa: string; desdeMeses: number; hastaMeses: number | null; labor: string; titulo: string; detalle: string; gramosPorPlanta: string | null; fuente: string;
}

export interface FilaLoteCultivo {
  id: string; fincaId: string; fincaNombre: string; codigo: string; nombre: string; areaHa: string | null; variedad: string | null;
  estado: string; numeroArboles: number | null; fechaSiembra: string | null; fechaUltimaZoca: string | null; edadMeses: number | null;
  cosechadoKg: string; eventos: EventoLote[];
}

export interface RepositorioCultivo {
  listarLotes(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaLoteCultivo[]>;
  listarRecomendaciones(tx: Transaccion, organizacionId: string): Promise<Recomendacion[]>;
  obtenerLote(tx: Transaccion, organizacionId: string, loteId: string): Promise<{ id: string; fincaId: string; estado: string; numeroArboles: number | null } | null>;
  aplicarEvento(tx: Transaccion, e: { organizacionId: string; loteId: string; tipo: string; fecha: string; arboles?: number; variedad?: string; detalle?: string; creadoPor: string }): Promise<void>;
  eliminarLote(tx: Transaccion, organizacionId: string, loteId: string): Promise<"eliminado" | "con_historial">;
}
