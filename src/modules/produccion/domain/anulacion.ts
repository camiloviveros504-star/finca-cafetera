import type { Transaccion } from "@/shared/dominio/contexto";

export interface CosechaParaAnular {
  id: string;
  fincaId: string;
  estado: string;
  movimientoId: string | null;
}

export interface RepositorioAnulacionCosecha {
  bloquearCosecha(tx: Transaccion, organizacionId: string, cosechaId: string): Promise<CosechaParaAnular | null>;
  marcarAnulada(tx: Transaccion, cosechaId: string, usuarioId: string, motivo: string): Promise<void>;
}
