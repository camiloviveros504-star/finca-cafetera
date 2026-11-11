import type { Transaccion } from "@/shared/dominio/contexto";

export interface DatosCliente {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  finalidad: string;
  autorizoEn: string | null;
  activo: boolean;
  anonimizadoEn: string | null;
  creadoEn: string;
}

export interface CamposRectificables {
  nombre?: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
}

export interface RepositorioDerechosCliente {
  obtener(tx: Transaccion, organizacionId: string, clienteId: string): Promise<DatosCliente | null>;
  resumenComercial(tx: Transaccion, organizacionId: string, clienteId: string): Promise<{ ventas: number; total: string; pedidos: number }>;
  actualizar(tx: Transaccion, organizacionId: string, clienteId: string, campos: CamposRectificables): Promise<void>;
  anonimizar(tx: Transaccion, organizacionId: string, clienteId: string): Promise<void>;
}
