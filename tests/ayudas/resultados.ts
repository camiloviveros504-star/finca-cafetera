import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** p-ésimo percentil (nearest-rank) de una lista de tiempos en milisegundos. */
export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
}

/**
 * Guarda la medición real en docs/pruebas/resultados/<id>.json solo si GUARDAR_RESULTADOS=si. Así el informe cita
 * valores ejecutados (con fecha, entorno y comando), no valores escritos a mano.
 */
export function guardarResultado(id: string, datos: Record<string, unknown>): void {
  if (process.env.GUARDAR_RESULTADOS !== "si") return;
  const carpeta = resolve(process.cwd(), "docs/pruebas/resultados");
  mkdirSync(carpeta, { recursive: true });
  const contenido = {
    id,
    fecha: new Date().toISOString(),
    entorno: process.env.ENTORNO_PRUEBA ?? "PostgreSQL 16 en Docker (local, Windows 11)",
    comando: process.env.COMANDO_PRUEBA ?? "vitest run",
    ...datos,
  };
  writeFileSync(resolve(carpeta, `${id}.json`), JSON.stringify(contenido, null, 2) + "\n", "utf8");
}
