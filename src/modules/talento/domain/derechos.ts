import type { Transaccion } from "@/shared/dominio/contexto";

export interface DatosTrabajador {
  id: string;
  usuarioId: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  finalidad: string | null;
  autorizoEn: string | null;
  anonimizadoEn: string | null;
}

export interface RepositorioDerechosTrabajador {
  obtener(tx: Transaccion, organizacionId: string, trabajadorId: string): Promise<DatosTrabajador | null>;
  resumenLaboral(tx: Transaccion, organizacionId: string, trabajadorId: string): Promise<{ registros: number; liquidaciones: number; anticipos: number }>;
  actualizar(tx: Transaccion, organizacionId: string, trabajadorId: string, campos: { nombres?: string; apellidos?: string; telefono?: string | null }): Promise<void>;
  anonimizar(tx: Transaccion, organizacionId: string, trabajadorId: string): Promise<void>;
}
