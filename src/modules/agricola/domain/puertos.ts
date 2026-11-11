import type { Transaccion } from "@/shared/dominio/contexto";

export interface FilaInspeccion {
  id: string; fecha: string; fincaNombre: string; loteCodigo: string | null; tipo: string; severidad: string;
  infestacionPct: string | null; hallazgos: string; acciones: string | null; inspector: string;
}
export interface FilaRegistroAmbiental {
  id: string; fecha: string; fincaNombre: string; tipo: string; descripcion: string; cantidad: string | null; unidad: string | null; responsable: string;
}
export interface FilaAgroquimico { id: string; nombre: string; unidad: string; carenciaDias: number | null }
export interface FilaStockAgroquimico {
  id: string; fincaId: string; fincaNombre: string; agroquimicoId: string; nombre: string; unidad: string; loteComercial: string;
  vencimiento: string; cantidad: string; vencido: boolean; porVencer: boolean;
}
export interface FilaAplicacion {
  id: string; fecha: string; fincaNombre: string; loteCodigo: string; agroquimico: string; loteComercial: string; dosis: string; unidadDosis: string;
  cantidadTotal: string; fechaReingreso: string | null; responsable: string;
}
export interface StockParaAplicar { id: string; fincaId: string; agroquimicoId: string; cantidad: string; vencimiento: string; carenciaDias: number | null; unidad: string }

export interface FilaActividad {
  id: string; fincaId: string; fincaNombre: string; loteCodigo: string | null; tipo: string; titulo: string; fechaProgramada: string;
  estado: "programada" | "completada" | "cancelada"; fechaCierre: string | null; resultado: string | null; atrasada: boolean;
}
export interface FilaProyeccion {
  id: string; fincaNombre: string; loteCodigo: string; desde: string; hasta: string; estimadoKg: string; realKg: string; cumplimientoPct: string | null; nota: string | null;
}

export interface FilaEquipo {
  id: string; fincaId: string; fincaNombre: string; tipo: string; codigo: string; nombre: string; estado: string;
  horasUso: string; combustibleLitros: string; costoMantenimiento: string; ultimoMantenimiento: string | null; proximoMantenimiento: string | null; mantenimientoVencido: boolean;
}
export interface FilaMantenimiento { id: string; fecha: string; equipo: string; tipo: string; descripcion: string; costo: string; proximoEn: string | null; conGasto: boolean }

export interface RepositorioAgricola {
  // Sanidad
  buscarInspeccionPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  loteEsDeFinca(tx: Transaccion, organizacionId: string, loteId: string, fincaId: string): Promise<boolean>;
  insertarInspeccion(tx: Transaccion, i: { organizacionId: string; fincaId: string; loteId?: string; fecha: string; tipo: string; severidad: string; infestacionPct?: string; hallazgos: string; acciones?: string; clave: string; inspectorId: string }): Promise<string>;
  listarInspecciones(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaInspeccion[]>;
  buscarAmbientalPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarAmbiental(tx: Transaccion, r: { organizacionId: string; fincaId: string; fecha: string; tipo: string; descripcion: string; cantidad?: string; unidad?: string; clave: string; responsableId: string }): Promise<string>;
  listarAmbientales(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaRegistroAmbiental[]>;
  crearAgroquimico(tx: Transaccion, a: { organizacionId: string; nombre: string; unidad: string; carenciaDias?: number }): Promise<string>;
  listarAgroquimicos(tx: Transaccion, organizacionId: string): Promise<FilaAgroquimico[]>;
  agroquimicoExiste(tx: Transaccion, organizacionId: string, id: string): Promise<boolean>;
  acreditarStock(tx: Transaccion, s: { organizacionId: string; fincaId: string; agroquimicoId: string; loteComercial: string; vencimiento: string; cantidad: string; usuarioId: string; nota?: string }): Promise<string>;
  bloquearStock(tx: Transaccion, organizacionId: string, stockId: string): Promise<StockParaAplicar | null>;
  descontarStock(tx: Transaccion, stockId: string, cantidad: string): Promise<void>;
  insertarMovimientoAgroquimico(tx: Transaccion, m: { organizacionId: string; stockId: string; tipo: "entrada" | "aplicacion" | "baja"; delta: string; origenId?: string; usuarioId: string; nota?: string }): Promise<void>;
  buscarAplicacionPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarAplicacion(tx: Transaccion, a: { organizacionId: string; fincaId: string; loteId: string; stockId: string; fecha: string; dosis: string; unidadDosis: string; cantidadTotal: string; fechaReingreso: string | null; inspeccionId?: string; responsableId: string; clave: string }): Promise<string>;
  listarStock(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], hoy: string): Promise<FilaStockAgroquimico[]>;
  listarAplicaciones(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaAplicacion[]>;
  // Planificación
  buscarActividadPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarActividad(tx: Transaccion, a: { organizacionId: string; fincaId: string; loteId?: string; tipo: string; titulo: string; fecha: string; clave: string; creadoPor: string }): Promise<string>;
  cerrarActividad(tx: Transaccion, v: { organizacionId: string; id: string; estado: "completada" | "cancelada"; fechaCierre: string; resultado?: string }): Promise<{ fincaId: string } | null>;
  listarActividades(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], hoy: string): Promise<FilaActividad[]>;
  buscarProyeccionPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarProyeccion(tx: Transaccion, p: { organizacionId: string; fincaId: string; loteId: string; desde: string; hasta: string; estimadoKg: string; nota?: string; clave: string; creadoPor: string }): Promise<string>;
  listarProyecciones(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaProyeccion[]>;
  // Maquinaria
  crearEquipo(tx: Transaccion, e: { organizacionId: string; fincaId: string; tipo: string; codigo: string; nombre: string; intervaloDias?: number }): Promise<string>;
  obtenerEquipo(tx: Transaccion, organizacionId: string, id: string): Promise<{ id: string; fincaId: string; nombre: string; estado: string } | null>;
  buscarUsoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarUso(tx: Transaccion, u: { organizacionId: string; equipoId: string; fecha: string; horas: string; combustible?: string; nota?: string; clave: string; registradoPor: string }): Promise<string>;
  buscarMantenimientoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null>;
  insertarMantenimiento(tx: Transaccion, m: { organizacionId: string; equipoId: string; fecha: string; tipo: string; descripcion: string; costo: string; proximoEn?: string; clave: string; registradoPor: string }): Promise<string>;
  vincularGasto(tx: Transaccion, mantenimientoId: string, gastoId: string): Promise<void>;
  listarEquipos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], hoy: string): Promise<FilaEquipo[]>;
  listarMantenimientos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaMantenimiento[]>;
}
