import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorRegla } from "@/shared/dominio/errores";
import type { PrecioVigente, RepositorioConfiguracion } from "../domain/puertos";

/** Los precios no se escriben en el código: salen de la tarifa versionada vigente en la fecha (QA-12). */
export async function obtenerPrecioVigente(
  deps: { repo: RepositorioConfiguracion },
  tx: Transaccion,
  entrada: { organizacionId: string; fincaId: string; productoId: string; fecha: string },
): Promise<PrecioVigente> {
  const precio = await deps.repo.precioVigente(tx, entrada.organizacionId, entrada.fincaId, entrada.productoId, entrada.fecha);
  if (!precio) throw new ErrorRegla("El producto no tiene un precio vigente configurado", "sin_precio_vigente");
  return precio;
}

/** Devuelve el factor (escala 6) para convertir de una unidad a otra; 1 si son la misma. */
export async function obtenerFactorConversion(
  deps: { repo: RepositorioConfiguracion },
  tx: Transaccion,
  entrada: { organizacionId: string; fincaId: string; origenId: string; destinoId: string; fecha: string },
): Promise<string> {
  if (entrada.origenId === entrada.destinoId) return "1.000000";
  const factor = await deps.repo.factorConversion(
    tx,
    entrada.organizacionId,
    entrada.fincaId,
    entrada.origenId,
    entrada.destinoId,
    entrada.fecha,
  );
  if (!factor) throw new ErrorRegla("No hay una equivalencia de unidades vigente para esa conversión", "sin_equivalencia");
  return factor;
}

export type { RepositorioConfiguracion } from "../domain/puertos";
