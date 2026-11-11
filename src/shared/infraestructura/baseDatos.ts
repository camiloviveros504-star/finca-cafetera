import { Pool, type PoolClient } from "pg";
import type { Transaccion } from "../dominio/contexto";
import type { UnidadDeTrabajo } from "../aplicacion/puertos";

export class TransaccionPg implements Transaccion {
  readonly _tipo = "transaccion" as const;
  constructor(readonly cliente: PoolClient) {}
}

/** Obtiene el cliente de PostgreSQL de una transacción opaca. */
export function clienteDe(tx: Transaccion): PoolClient {
  return (tx as TransaccionPg).cliente;
}

const global = globalThis as unknown as { __poolFinca?: Pool };

function esLocal(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "db";
}

/** Pool pequeño por instancia: Render Free no tiene pool de conexiones propio (riesgo R-01). */
export function crearPool(url = process.env.DATABASE_URL): Pool {
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: esLocal(url) ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function obtenerPool(): Pool {
  global.__poolFinca ??= crearPool();
  return global.__poolFinca;
}

export class UnidadDeTrabajoPg implements UnidadDeTrabajo {
  constructor(private readonly pool: Pool) {}

  async ejecutar<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      // Evita esperas indefinidas por bloqueos de fila (ADR-002).
      await cliente.query("SET LOCAL lock_timeout = '5s'");
      const resultado = await fn(new TransaccionPg(cliente));
      await cliente.query("COMMIT");
      return resultado;
    } catch (error) {
      await cliente.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  async consultar<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      return await fn(new TransaccionPg(cliente));
    } finally {
      cliente.release();
    }
  }
}
