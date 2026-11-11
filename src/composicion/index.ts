/**
 * Raíz de composición: único lugar que conoce a la vez los casos de uso y sus implementaciones
 * de infraestructura. La presentación (src/app) solo importa este archivo, nunca la infraestructura.
 */
import type { Pool } from "pg";
import { AuditorPg } from "@/modules/auditoria/infrastructure/auditorPg";
import { RepositorioConfiguracionPg } from "@/modules/configuracion/infrastructure/repositorioConfiguracionPg";
import { RepositorioIdentidadPg } from "@/modules/identidad/infrastructure/repositorioIdentidadPg";
import { RepositorioInventarioPg } from "@/modules/inventario/infrastructure/repositorioInventarioPg";
import { RepositorioVentasPg } from "@/modules/comercial/infrastructure/repositorioVentasPg";
import { RepositorioProduccionPg } from "@/modules/produccion/infrastructure/repositorioProduccionPg";
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
  produccion: DependenciasProduccion;
  trazabilidad: DependenciasTrazabilidad;
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
    produccion: { produccion: new RepositorioProduccionPg(), inventario: inventarioRepo, configuracion, uow, auditor },
    trazabilidad: { repo: new RepositorioTrazabilidadPg(), uow, auditor },
  };
}

const global = globalThis as unknown as { __serviciosFinca?: Servicios };

export function servicios(): Servicios {
  global.__serviciosFinca ??= crearServicios(obtenerPool());
  return global.__serviciosFinca;
}

export { iniciarSesion, obtenerContexto, cerrarSesion } from "@/modules/identidad/application/sesiones";
export { registrarVenta, listarVentas } from "@/modules/comercial/application/registrarVenta";
export { consultarSaldos } from "@/modules/inventario/application/movimientos";
export { registrarCosecha, listarCosechas, obtenerOpcionesRegistro } from "@/modules/produccion/application/cosechas";
export { consultarTrazabilidadVenta } from "@/modules/trazabilidad/application/consultarTrazabilidad";
export * from "@/shared/dominio/errores";
export type { ContextoUsuario } from "@/shared/dominio/contexto";
