import type { Transaccion } from "@/shared/dominio/contexto";

export interface FilaAuditoria {
  id: string;
  fecha: string;
  usuario: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  resultado: "ok" | "denegado" | "error";
  detalle: string | null;
  ip: string | null;
}

export interface FiltroAuditoria {
  resultado?: string;
  accion?: string;
  entidad?: string;
}

export interface ConsultaAuditoria {
  listar(tx: Transaccion, organizacionId: string, filtro: FiltroAuditoria, limite: number, desplazamiento: number): Promise<{ filas: FilaAuditoria[]; total: number }>;
}
