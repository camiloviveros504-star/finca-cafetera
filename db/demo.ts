/**
 * Un solo comando para la demo SIN Docker: `npm run demo`
 * Levanta PostgreSQL real (embedded-postgres), migra, siembra los datos DEMO y arranca la aplicación.
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prepararBase } from "./iniciar";

const carpeta = join(process.cwd(), ".pgdata");
const puerto = Number(process.env.PGPUERTO ?? 5433);
const url = `postgresql://finca:finca_local@localhost:${puerto}/finca`;

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

  process.env.DATABASE_URL = url;
  process.env.SEMBRAR_DEMO = "si";
  process.env.SESSION_SECRET ??= "demo-local-no-usar-en-produccion-0000000000";
  await prepararBase(url);

  if (!existsSync(join(process.cwd(), ".next", "BUILD_ID"))) {
    console.log("Compilando la aplicación (primera vez)…");
    const r = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: true });
    if (r.status !== 0) throw new Error("Falló next build");
  }
  const app = spawn("npx", ["next", "start", "-p", process.env.PORT ?? "3000"], { stdio: "inherit", shell: true, env: process.env });
  const salir = async () => {
    app.kill();
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", salir);
  process.on("SIGTERM", salir);
  app.on("exit", salir);
  console.log("\nAplicación en http://localhost:3000  ·  usuarios DEMO: admin@demo.local, produccion@demo.local, comercial@demo.local  ·  contraseña: Demo-2026!");
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
