import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";

const carpeta = join(__dirname, "migraciones");

/** Aplica en orden las migraciones SQL pendientes. Cada una corre en su propia transacción. */
export async function migrar(cliente: Client): Promise<string[]> {
  await cliente.query(
    `CREATE TABLE IF NOT EXISTS migracion (
       nombre text PRIMARY KEY,
       aplicada_en timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const hechas = new Set(
    (await cliente.query<{ nombre: string }>("SELECT nombre FROM migracion")).rows.map((f) => f.nombre),
  );
  const aplicadas: string[] = [];
  const archivos = readdirSync(carpeta)
    .filter((a) => a.endsWith(".sql"))
    .sort();
  for (const archivo of archivos) {
    if (hechas.has(archivo)) continue;
    const sql = readFileSync(join(carpeta, archivo), "utf8");
    try {
      await cliente.query("BEGIN");
      await cliente.query(sql);
      await cliente.query("INSERT INTO migracion (nombre) VALUES ($1)", [archivo]);
      await cliente.query("COMMIT");
      aplicadas.push(archivo);
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw new Error(`Falló la migración ${archivo}: ${(error as Error).message}`);
    }
  }
  return aplicadas;
}
