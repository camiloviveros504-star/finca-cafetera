import type { ContextoUsuario } from "../dominio/contexto";
import { ErrorProhibido } from "../dominio/errores";
import type { Auditor } from "./puertos";

interface OpcionesAutorizar {
  accion: string;
  entidad: string;
  /** Si se indica, el usuario además debe tener asignada esa finca. */
  fincaId?: string;
}

/**
 * Comprobación de permiso en el servidor (D3). Todo caso de uso la llama primero.
 * Un intento rechazado queda en la auditoría y responde 403 sin ejecutar nada.
 */
export async function autorizar(
  auditor: Auditor,
  ctx: ContextoUsuario,
  permiso: string,
  opciones: OpcionesAutorizar,
): Promise<void> {
  const sinPermiso = !ctx.permisos.has(permiso);
  const sinFinca = opciones.fincaId !== undefined && !ctx.fincaIds.includes(opciones.fincaId);
  if (!sinPermiso && !sinFinca) return;
  await auditor.registrar({
    organizacionId: ctx.organizacionId,
    usuarioId: ctx.usuarioId,
    accion: opciones.accion,
    entidad: opciones.entidad,
    entidadId: opciones.fincaId ?? null,
    resultado: "denegado",
    despues: { permisoRequerido: permiso, motivo: sinPermiso ? "sin_permiso" : "finca_no_asignada" },
    ip: ctx.ip,
  });
  throw new ErrorProhibido();
}
