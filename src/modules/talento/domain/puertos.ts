import type { Transaccion } from "@/shared/dominio/contexto";
import type { Modalidad } from "./calculos";

export interface FilaTrabajador {
  id: string;
  usuarioId: string | null;
  documento: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  vinculaciones: { fincaId: string; fincaNombre: string; modalidad: Modalidad; desde: string; hasta: string | null }[];
  // Cantidades diferenciadas (declarada, validada, liquidada, pagada) y saldo pendiente.
  registrosPendientes: number;
  validadoValor: string;
  liquidadoNeto: string;
  pagado: string;
  saldoPendiente: string;
  anticiposPendientes: string;
}

export interface FilaRegistroTrabajo {
  id: string;
  trabajadorId: string;
  trabajadorNombre: string;
  fincaId: string;
  fincaNombre: string;
  loteCodigo: string | null;
  fecha: string;
  modalidad: Modalidad;
  actividad: string | null;
  cantidadDeclarada: string;
  unidadDeclarada: string;
  cantidadValidada: string | null;
  estado: "pendiente" | "validado" | "rechazado" | "liquidado";
  valorUnitario: string | null;
  valor: string | null;
  motivoRechazo: string | null;
}

export interface RegistroParaValidar {
  id: string;
  fincaId: string;
  trabajadorId: string;
  trabajadorUsuarioId: string | null;
  fecha: string;
  modalidad: Modalidad;
  cantidadDeclarada: string;
  unidadDeclarada: string;
  estado: string;
}

export interface FilaLiquidacion {
  id: string;
  trabajadorId: string;
  trabajadorNombre: string;
  desde: string;
  hasta: string;
  totalBruto: string;
  totalAnticipos: string;
  neto: string;
  pagado: string;
  saldo: string;
  estado: "liquidada" | "pagada";
  creadaEn: string;
}

export interface RepositorioTalento {
  crearTrabajador(tx: Transaccion, t: { organizacionId: string; tipoDocumento: string; numeroDocumento: string; nombres: string; apellidos: string; telefono?: string; usuarioId?: string; finalidad: string; creadoPor: string }): Promise<string>;
  crearVinculacion(tx: Transaccion, v: { organizacionId: string; trabajadorId: string; fincaId: string; modalidad: Modalidad; cargo?: string; desde: string; hasta?: string }): Promise<string>;
  listarTrabajadores(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloUsuarioId?: string): Promise<FilaTrabajador[]>;
  trabajadorDeUsuario(tx: Transaccion, organizacionId: string, usuarioId: string): Promise<string | null>;
  trabajadorUsuario(tx: Transaccion, organizacionId: string, trabajadorId: string): Promise<{ existe: boolean; usuarioId: string | null }>;
  vinculacionVigente(tx: Transaccion, organizacionId: string, trabajadorId: string, fincaId: string, fecha: string): Promise<{ id: string; modalidad: Modalidad } | null>;
  loteEsDeFinca(tx: Transaccion, organizacionId: string, loteId: string, fincaId: string): Promise<boolean>;
  unidadId(tx: Transaccion, codigo: string): Promise<string | null>;
  buscarRegistroPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarRegistro(tx: Transaccion, r: { organizacionId: string; fincaId: string; loteId?: string; trabajadorId: string; vinculacionId: string; fecha: string; modalidad: Modalidad; actividad?: string; cantidad: string; unidadId: string; clave?: string; registradoPor: string }): Promise<string>;
  bloquearRegistro(tx: Transaccion, organizacionId: string, id: string): Promise<RegistroParaValidar | null>;
  validarRegistro(tx: Transaccion, v: { id: string; cantidadValidada: string; tarifaVersionId: string; valorUnitario: string; valor: string; validadoPor: string }): Promise<void>;
  rechazarRegistro(tx: Transaccion, v: { id: string; motivo: string; validadoPor: string }): Promise<void>;
  listarRegistros(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], opciones: { estado?: string; trabajadorId?: string }): Promise<FilaRegistroTrabajo[]>;
  registrosParaLiquidar(tx: Transaccion, organizacionId: string, trabajadorId: string, fincaIds: readonly string[], desde: string, hasta: string): Promise<{ id: string; cantidadValidada: string; valorUnitario: string; valor: string }[]>;
  anticiposPendientes(tx: Transaccion, organizacionId: string, trabajadorId: string): Promise<{ id: string; saldo: string }[]>;
  buscarLiquidacionPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<FilaLiquidacion | null>;
  insertarLiquidacion(tx: Transaccion, l: { organizacionId: string; trabajadorId: string; desde: string; hasta: string; totalBruto: string; totalAnticipos: string; neto: string; clave?: string; liquidadaPor: string }): Promise<string>;
  insertarDetalleLiquidacion(tx: Transaccion, d: { liquidacionId: string; registroId: string; cantidad: string; valorUnitario: string; valor: string }): Promise<void>;
  descontarAnticipo(tx: Transaccion, liquidacionId: string, anticipoId: string, monto: string): Promise<void>;
  insertarAnticipo(tx: Transaccion, a: { organizacionId: string; trabajadorId: string; fecha: string; monto: string; nota?: string; clave?: string; registradoPor: string }): Promise<string>;
  buscarAnticipoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  bloquearLiquidacion(tx: Transaccion, organizacionId: string, id: string): Promise<{ neto: string; pagado: string } | null>;
  buscarPagoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarPago(tx: Transaccion, p: { organizacionId: string; liquidacionId: string; monto: string; metodo: string; fecha: string; clave?: string; registradoPor: string }): Promise<string>;
  metodoDePagoExiste(tx: Transaccion, organizacionId: string, codigo: string): Promise<boolean>;
  listarLiquidaciones(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloTrabajadorId?: string): Promise<FilaLiquidacion[]>;
}
