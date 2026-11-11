import "server-only";
import { ErrorNegocio, ErrorValidacion } from "@/composicion";

export interface EstadoFormulario {
  ok?: boolean;
  error?: string;
  campos?: Record<string, string>;
  mensaje?: string;
}

/** Convierte un error en un mensaje seguro para el usuario: nunca expone detalles internos. */
export function aEstadoError(error: unknown): EstadoFormulario {
  if (error instanceof ErrorValidacion) return { error: error.message, campos: error.campos };
  if (error instanceof ErrorNegocio) return { error: error.message };
  console.error("Error no controlado:", error instanceof Error ? error.name : "desconocido");
  return { error: "Ocurrió un error inesperado. Intente de nuevo." };
}
