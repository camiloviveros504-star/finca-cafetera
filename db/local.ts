/**
 * Levanta un PostgreSQL real y local (binarios de embedded-postgres) cuando no hay Docker.
 * Uso: npm run db:local   (deja el proceso corriendo; Ctrl+C para detenerlo)
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join } from "node:path";

const carpeta = join(process.cwd(), ".pgdata");
const puerto = Number(process.env.PGPUERTO ?? 5433);

async function principal() {
  const pg = new EmbeddedPostgres({
    databaseDir: carpeta,
    user: "finca",
    password: "finca_local",
    port: puerto,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  const nueva = !existsSync(join(carpeta, "PG_VERSION"));
  if (nueva) await pg.initialise();
  await pg.start();
  if (nueva) await pg.createDatabase("finca");
  console.log(`PostgreSQL local listo en postgresql://finca:finca_local@localhost:${puerto}/finca`);
  const detener = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", detener);
  process.on("SIGTERM", detener);
  setInterval(() => undefined, 1 << 30);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
