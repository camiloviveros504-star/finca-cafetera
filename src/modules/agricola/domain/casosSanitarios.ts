import type { Transaccion } from "@/shared/dominio/contexto";

export const TIPOS_PLAGA = ["broca", "roya", "mancha_hierro", "ojo_gallo", "cochinilla", "minador", "llaga", "antracnosis", "otra"] as const;
export type TipoPlaga = (typeof TIPOS_PLAGA)[number];

export const ESTADOS_CASO = ["detectado", "en_tratamiento", "mejorando", "controlado"] as const;
export type EstadoCaso = (typeof ESTADOS_CASO)[number];

/** Nombres para mostrar (los usa también la interfaz). */
export const NOMBRE_PLAGA: Record<TipoPlaga, string> = {
  broca: "Broca", roya: "Roya", mancha_hierro: "Mancha de hierro", ojo_gallo: "Ojo de gallo", cochinilla: "Cochinillas de la raíz",
  minador: "Minador de la hoja", llaga: "Llagas radicales", antracnosis: "Antracnosis", otra: "Otra",
};
export const NOMBRE_ESTADO: Record<EstadoCaso, string> = { detectado: "Detectada", en_tratamiento: "En tratamiento", mejorando: "Mejorando", controlado: "Controlada" };

export interface SeguimientoCaso {
  id: string; fecha: string; estado: EstadoCaso; nota: string; aplicacion: string | null; responsable: string;
}

export interface CasoSanitario {
  id: string; fincaId: string; fincaNombre: string; loteId: string; loteCodigo: string; loteNombre: string;
  tipo: TipoPlaga; nombre: string; severidad: "baja" | "media" | "alta"; afectacionPct: string | null; descripcion: string;
  estado: EstadoCaso; detectadoEn: string; controladoEn: string | null; diasAbierto: number;
  seguimientos: SeguimientoCaso[];
}

export interface RepositorioCasosSanitarios {
  loteDeOrganizacion(tx: Transaccion, organizacionId: string, loteId: string): Promise<{ fincaId: string } | null>;
  buscarPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  crear(tx: Transaccion, c: { organizacionId: string; fincaId: string; loteId: string; tipo: TipoPlaga; otroNombre?: string; severidad: string; afectacionPct?: string; descripcion: string; detectadoEn: string; clave: string; creadoPor: string }): Promise<string>;
  bloquear(tx: Transaccion, organizacionId: string, casoId: string): Promise<{ id: string; fincaId: string; loteId: string; estado: EstadoCaso; detectadoEn: string } | null>;
  aplicacionDelLote(tx: Transaccion, organizacionId: string, aplicacionId: string, loteId: string): Promise<boolean>;
  agregarSeguimiento(tx: Transaccion, s: { organizacionId: string; casoId: string; fecha: string; estado: EstadoCaso; nota: string; aplicacionId?: string; registradoPor: string }): Promise<void>;
  listar(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloAbiertos: boolean): Promise<CasoSanitario[]>;
}
