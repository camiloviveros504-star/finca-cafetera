/**
 * Raíz de composición: único lugar que conoce a la vez los casos de uso y sus implementaciones
 * de infraestructura. La presentación (src/app) solo importa este archivo, nunca la infraestructura.
 */
import type { Pool } from "pg";
import { AuditorPg } from "@/modules/auditoria/infrastructure/auditorPg";
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
import { RepositorioFincasLotesPg } from "@/modules/produccion/infrastructure/repositorioFincasLotesPg";
import type { DependenciasFincasLotes } from "@/modules/produccion/application/fincasLotes";
import { RepositorioTalentoPg } from "@/modules/talento/infrastructure/repositorioTalentoPg";
import type { DependenciasTalento } from "@/modules/talento/application/talento";
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
}

export function crearServicios(pool: Pool): Servicios {
  const uow = new UnidadDeTrabajoPg(pool);
  const auditor = new AuditorPg(pool);
  const inventarioRepo = new RepositorioInventarioPg();
  const configuracion = new RepositorioConfiguracionPg();
  return {
    sesion: {
      repo: new RepositorioIdentidadPg(pool),
      contrasenas: { verificar: verificarContrasena, hashDeRelleno },
      auditor,
    },
    comercial: { ventas: new RepositorioVentasPg(), inventario: inventarioRepo, configuracion, uow, auditor },
    inventario: { repo: inventarioRepo, uow, auditor },
    operaciones: { repo: inventarioRepo, ops: new RepositorioOperacionesPg(), uow, auditor },
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
export { crearCliente, listarClientes, crearPedido, listarPedidos } from "@/modules/comercial/application/clientesPedidos";
export { obtenerPanel, type ResumenPanel } from "@/modules/panel/application/obtenerPanel";
export { crearFinca, crearLote, listarFincasYLotes } from "@/modules/produccion/application/fincasLotes";
export { consultarSaldos } from "@/modules/inventario/application/movimientos";
export { registrarAjuste, trasladar, transformar, reversarMovimiento, listarMovimientos } from "@/modules/inventario/application/operaciones";
export { registrarCosecha, listarCosechas, obtenerOpcionesRegistro } from "@/modules/produccion/application/cosechas";
export { consultarTrazabilidadVenta } from "@/modules/trazabilidad/application/consultarTrazabilidad";
export {
  crearTrabajador, crearVinculacion, listarTrabajadores, registrarTrabajo, validarTrabajo, listarTrabajos,
  registrarAnticipo, liquidarPeriodo, registrarPagoTrabajador, listarLiquidaciones,
  type FilaLiquidacion, type FilaRegistroTrabajo, type FilaTrabajador, type Modalidad,
} from "@/modules/talento/application/talento";
export * from "@/shared/dominio/errores";
export type { ContextoUsuario } from "@/shared/dominio/contexto";
