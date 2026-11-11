/**
 * Raíz de composición: único lugar que conoce a la vez los casos de uso y sus implementaciones
 * de infraestructura. La presentación (src/app) solo importa este archivo, nunca la infraestructura.
 */
import type { Pool } from "pg";
import { AuditorPg } from "@/modules/auditoria/infrastructure/auditorPg";
import type { DependenciasInvitaciones } from "@/modules/identidad/application/invitaciones";
import { RepositorioInstalacionPg } from "@/modules/identidad/infrastructure/repositorioInstalacionPg";
import type { DependenciasInstalacion } from "@/modules/identidad/application/instalacion";
import { RepositorioAnulacionPg } from "@/modules/comercial/infrastructure/repositorioAnulacionPg";
import { RepositorioDerechosPg } from "@/modules/comercial/infrastructure/repositorioDerechosPg";
import type { DependenciasDerechosCliente } from "@/modules/comercial/application/derechosCliente";
import { RepositorioDerechosTrabajadorPg } from "@/modules/talento/infrastructure/repositorioDerechosPg";
import type { DependenciasDerechosTrabajador } from "@/modules/talento/application/derechosTrabajador";
import type { DependenciasAnulacionVenta } from "@/modules/comercial/application/anularVenta";
import { RepositorioAnulacionCosechaPg } from "@/modules/produccion/infrastructure/repositorioAnulacionPg";
import type { DependenciasAnulacionCosecha } from "@/modules/produccion/application/anularCosecha";
import { RepositorioConfiguracionPg } from "@/modules/configuracion/infrastructure/repositorioConfiguracionPg";
import { RepositorioTarifasPg } from "@/modules/configuracion/infrastructure/repositorioTarifasPg";
import type { DependenciasTarifas } from "@/modules/configuracion/application/tarifas";
import { RepositorioIdentidadPg } from "@/modules/identidad/infrastructure/repositorioIdentidadPg";
import { RepositorioInventarioPg } from "@/modules/inventario/infrastructure/repositorioInventarioPg";
import { RepositorioOperacionesPg } from "@/modules/inventario/infrastructure/repositorioOperacionesPg";
import type { DependenciasOperaciones } from "@/modules/inventario/application/operaciones";
import { RepositorioVentasPg } from "@/modules/comercial/infrastructure/repositorioVentasPg";
import { RepositorioClientesPg } from "@/modules/comercial/infrastructure/repositorioClientesPg";
import { RepositorioPanelPg } from "@/modules/panel/infrastructure/repositorioPanelPg";
import type { DependenciasClientes } from "@/modules/comercial/application/clientesPedidos";
import type { DependenciasPanel } from "@/modules/panel/application/obtenerPanel";
import { RepositorioProduccionPg } from "@/modules/produccion/infrastructure/repositorioProduccionPg";
import { RepositorioCultivoPg } from "@/modules/produccion/infrastructure/repositorioCultivoPg";
import type { DependenciasCultivo } from "@/modules/produccion/application/cultivo";
import { RepositorioFincasLotesPg } from "@/modules/produccion/infrastructure/repositorioFincasLotesPg";
import type { DependenciasFincasLotes } from "@/modules/produccion/application/fincasLotes";
import { RepositorioTalentoPg } from "@/modules/talento/infrastructure/repositorioTalentoPg";
import type { DependenciasTalento } from "@/modules/talento/application/talento";
import { RepositorioBeneficioPg } from "@/modules/beneficio/infrastructure/repositorioBeneficioPg";
import type { DependenciasBeneficio } from "@/modules/beneficio/application/beneficio";
import { RepositorioFinanzasPg } from "@/modules/finanzas/infrastructure/repositorioFinanzasPg";
import type { DependenciasFinanzas } from "@/modules/finanzas/application/finanzas";
import { RepositorioPagosPg } from "@/modules/comercial/infrastructure/repositorioPagosPg";
import type { DependenciasPagos } from "@/modules/comercial/application/pagosClientes";
import { RepositorioAgricolaPg } from "@/modules/agricola/infrastructure/repositorioAgricolaPg";
import type { DependenciasEliminacion } from "@/shared/aplicacion/eliminar";
import { RepositorioEliminacionPg } from "@/shared/infraestructura/repositorioEliminacionPg";
import type { InsumosParaCompras } from "@/modules/finanzas/domain/puertos";
import type { DependenciasAgricola } from "@/modules/agricola/application/comun";
import { RepositorioAjustesPg } from "@/modules/configuracion/infrastructure/repositorioAjustesPg";
import type { DependenciasAjustes } from "@/modules/configuracion/application/ajustes";
import { RepositorioUsuariosPg } from "@/modules/identidad/infrastructure/repositorioUsuariosPg";
import type { DependenciasUsuarios } from "@/modules/identidad/application/usuarios";
import { ConsultaAuditoriaPg } from "@/modules/auditoria/infrastructure/consultaAuditoriaPg";
import type { DependenciasAuditoria } from "@/modules/auditoria/application/consultarAuditoria";
import { cifrarContrasena } from "@/shared/infraestructura/contrasenas";
import { RepositorioTrazabilidadPg } from "@/modules/trazabilidad/infrastructure/repositorioTrazabilidadPg";
import { hashDeRelleno, verificarContrasena } from "@/shared/infraestructura/contrasenas";
import { obtenerPool, UnidadDeTrabajoPg } from "@/shared/infraestructura/baseDatos";
import type { DependenciasSesion } from "@/modules/identidad/application/sesiones";
import type { DependenciasComercial } from "@/modules/comercial/application/registrarVenta";
import type { DependenciasInventario } from "@/modules/inventario/application/movimientos";
import type { DependenciasProduccion } from "@/modules/produccion/application/cosechas";
import type { DependenciasTrazabilidad } from "@/modules/trazabilidad/application/consultarTrazabilidad";

export interface Servicios {
  sesion: DependenciasSesion;
  comercial: DependenciasComercial;
  inventario: DependenciasInventario;
  operaciones: DependenciasOperaciones;
  tarifas: DependenciasTarifas;
  clientes: DependenciasClientes;
  panel: DependenciasPanel;
  fincasLotes: DependenciasFincasLotes;
  produccion: DependenciasProduccion;
  trazabilidad: DependenciasTrazabilidad;
  talento: DependenciasTalento;
  beneficio: DependenciasBeneficio;
  finanzas: DependenciasFinanzas;
  pagos: DependenciasPagos;
  agricola: DependenciasAgricola;
  instalacion: DependenciasInstalacion;
  cultivo: DependenciasCultivo;
  eliminacion: DependenciasEliminacion;
  invitaciones: DependenciasInvitaciones;
  derechosCliente: DependenciasDerechosCliente;
  derechosTrabajador: DependenciasDerechosTrabajador;
  anulacionVenta: DependenciasAnulacionVenta;
  anulacionCosecha: DependenciasAnulacionCosecha;
  ajustes: DependenciasAjustes;
  usuarios: DependenciasUsuarios;
  auditoria: DependenciasAuditoria;
}

export function crearServicios(pool: Pool, opciones: { codigoInstalacion?: string } = {}): Servicios {
  const uow = new UnidadDeTrabajoPg(pool);
  const auditor = new AuditorPg(pool);
  const identidadRepo = new RepositorioIdentidadPg(pool);
  const inventarioRepo = new RepositorioInventarioPg();
  const agricolaRepo = new RepositorioAgricolaPg();
  // Una compra recibida suma al inventario de insumos (el módulo financiero no conoce el agrícola: se conectan aquí).
  const insumosParaCompras: InsumosParaCompras = {
    nombre: async (tx, org, fincaId, insumoId) => (await agricolaRepo.listarAgroquimicos(tx, org, [fincaId])).find((x) => x.id === insumoId)?.nombre ?? null,
    acreditar: async (tx, e) => {
      await agricolaRepo.acreditarStock(tx, { organizacionId: e.organizacionId, fincaId: e.fincaId, agroquimicoId: e.insumoId, loteComercial: "Compras", vencimiento: null, cantidad: e.cantidad, usuarioId: e.usuarioId, nota: e.referencia });
    },
  };
  const configuracion = new RepositorioConfiguracionPg();
  const operaciones: DependenciasOperaciones = { repo: inventarioRepo, ops: new RepositorioOperacionesPg(), uow, auditor };
  return {
    sesion: {
      repo: identidadRepo,
      contrasenas: { verificar: verificarContrasena, hashDeRelleno },
      auditor,
    },
    comercial: { ventas: new RepositorioVentasPg(), inventario: inventarioRepo, configuracion, uow, auditor },
    inventario: { repo: inventarioRepo, uow, auditor },
    operaciones,
    beneficio: { repo: new RepositorioBeneficioPg(), operaciones, uow, auditor },
    finanzas: { repo: new RepositorioFinanzasPg(), insumos: insumosParaCompras, uow, auditor },
    pagos: { repo: new RepositorioPagosPg(), uow, auditor },
    invitaciones: { repo: new RepositorioUsuariosPg(), acceso: identidadRepo, cifrar: cifrarContrasena, uow, auditor },
    cultivo: { repo: new RepositorioCultivoPg(), configuracion, uow, auditor },
    eliminacion: { repo: new RepositorioEliminacionPg(), uow, auditor },
    instalacion: { repo: new RepositorioInstalacionPg(), cifrar: cifrarContrasena, uow, auditor, codigoEsperado: opciones.codigoInstalacion ?? process.env.CODIGO_INSTALACION },
    derechosCliente: { repo: new RepositorioDerechosPg(), uow, auditor },
    derechosTrabajador: { repo: new RepositorioDerechosTrabajadorPg(), uow, auditor },
    anulacionVenta: { repo: new RepositorioAnulacionPg(), operaciones, uow, auditor },
    anulacionCosecha: { repo: new RepositorioAnulacionCosechaPg(), operaciones, uow, auditor },
    ajustes: { repo: new RepositorioAjustesPg(), uow, auditor },
    usuarios: { repo: new RepositorioUsuariosPg(), cifrar: cifrarContrasena, uow, auditor },
    auditoria: { consulta: new ConsultaAuditoriaPg(), uow, auditor },
    agricola: { repo: agricolaRepo, finanzas: { repo: new RepositorioFinanzasPg(), uow, auditor }, uow, auditor },
    produccion: { produccion: new RepositorioProduccionPg(), inventario: inventarioRepo, configuracion, uow, auditor },
    trazabilidad: { repo: new RepositorioTrazabilidadPg(), uow, auditor },
    talento: { repo: new RepositorioTalentoPg(), configuracion, uow, auditor },
    tarifas: { repo: new RepositorioTarifasPg(), uow, auditor },
    clientes: { repo: new RepositorioClientesPg(), uow, auditor },
    panel: { repo: new RepositorioPanelPg(), uow },
    fincasLotes: { repo: new RepositorioFincasLotesPg(), uow, auditor },
  };
}

const global = globalThis as unknown as { __serviciosFinca?: Servicios };

export function servicios(): Servicios {
  global.__serviciosFinca ??= crearServicios(obtenerPool());
  return global.__serviciosFinca;
}

export { iniciarSesion, obtenerContexto, cerrarSesion } from "@/modules/identidad/application/sesiones";
export { registrarVenta, listarVentas, obtenerOpcionesVenta } from "@/modules/comercial/application/registrarVenta";
export { crearVersionTarifa, crearTarifa, listarTarifas, historialTarifa } from "@/modules/configuracion/application/tarifas";
export { crearCliente, registrarComprador, listarClientes, crearPedido, listarPedidos } from "@/modules/comercial/application/clientesPedidos";
export { obtenerPanel, type ResumenPanel } from "@/modules/panel/application/obtenerPanel";
export { crearFinca, crearLote, listarFincasYLotes } from "@/modules/produccion/application/fincasLotes";
export { consultarSaldos } from "@/modules/inventario/application/movimientos";
export { registrarAjuste, trasladar, transformar, reversarMovimiento, listarMovimientos } from "@/modules/inventario/application/operaciones";
export { registrarCosecha, listarCosechas, obtenerOpcionesRegistro } from "@/modules/produccion/application/cosechas";
export { consultarTrazabilidadVenta } from "@/modules/trazabilidad/application/consultarTrazabilidad";
export {
  crearTrabajador, crearVinculacion, vincularUsuarioATrabajador, registrarJornada, LABORES, listarTrabajadores, registrarTrabajo, validarTrabajo, listarTrabajos,
  registrarAnticipo, liquidarPeriodo, registrarPagoTrabajador, listarLiquidaciones,
  type FilaLiquidacion, type FilaRegistroTrabajo, type FilaTrabajador, type Modalidad,
} from "@/modules/talento/application/talento";
export {
  crearProcesoTipo, listarProcesos, ejecutarEtapa, listarRegistrosProceso,
  type FilaProceso, type FilaRegistroProceso, type EtapaProceso,
} from "@/modules/beneficio/application/beneficio";
export { registrarPagoCliente, listarCartera, type FilaCartera } from "@/modules/comercial/application/pagosClientes";
export {
  crearProveedor, listarProveedores, registrarCompra, recibirCompra, pagarCompra, listarCompras, registrarGasto, listarGastos,
  obtenerResumenFinanciero, obtenerConciliacion,
  type Conciliacion, type FilaCompra, type FilaGasto, type FilaProveedor, type MovimientoFinanciero, type ResumenFinanciero,
} from "@/modules/finanzas/application/finanzas";
export {
  registrarInspeccion, listarInspecciones, registrarAmbiental, listarAmbientales, crearAgroquimico, registrarEntradaAgroquimico, registrarAplicacion, listarAgroquimicos,
} from "@/modules/agricola/application/sanidad";
export { programarActividad, cerrarActividad, listarActividades, registrarProyeccion, listarProyecciones } from "@/modules/agricola/application/planificacion";
export { crearEquipo, registrarUsoEquipo, registrarMantenimiento, listarEquipos } from "@/modules/agricola/application/maquinaria";
export type {
  FilaActividad, FilaAgroquimico, FilaAplicacion, FilaEquipo, FilaInspeccion, FilaMantenimiento, FilaProyeccion, FilaRegistroAmbiental, FilaStockAgroquimico,
} from "@/modules/agricola/domain/puertos";
export {
  obtenerAjustes, crearValorCatalogo, cambiarEstadoValorCatalogo, crearEquivalencia, crearTemporada, guardarParametro,
  type Equivalencia, type ParametroConfigurado, type Temporada, type ValorCatalogo,
} from "@/modules/configuracion/application/ajustes";
export { listarUsuarios, crearUsuario, asignarRolesYFincas, cambiarEstadoUsuario, restablecerContrasena, cambiarPermisoExtra, type FilaPermiso, type FilaRol, type FilaUsuario } from "@/modules/identidad/application/usuarios";
export { consultarAuditoria, type FilaAuditoria, type FiltroAuditoria } from "@/modules/auditoria/application/consultarAuditoria";
export { invitarUsuario, emitirEnlace, consultarInvitacion, activarCuenta, DURACION_INVITACION_MS } from "@/modules/identidad/application/invitaciones";
export { consultarCultivo, registrarEventoLote, eliminarLote, type LoteConPlan, type ItemPlan, DENSIDAD_POR_DEFECTO } from "@/modules/produccion/application/cultivo";
export { obtenerEstadoInstalacion, instalarSistema, LARGO_MINIMO_CODIGO } from "@/modules/identidad/application/instalacion";
export { anularVenta } from "@/modules/comercial/application/anularVenta";
export { exportarDatosCliente, rectificarCliente, anonimizarCliente } from "@/modules/comercial/application/derechosCliente";
export { exportarDatosTrabajador, rectificarTrabajador, anonimizarTrabajador } from "@/modules/talento/application/derechosTrabajador";
export { anularCosecha } from "@/modules/produccion/application/anularCosecha";
export * from "@/shared/dominio/errores";
export type { ContextoUsuario } from "@/shared/dominio/contexto";

export { registrarRecoleccion } from "./recoleccion";
export { eliminarRegistro } from "@/shared/aplicacion/eliminar";
export { altaDeFinca } from "./altaFinca";
