/**
 * Arranque local SIN Docker: `npm run iniciar` (o `npm run iniciar:ejemplo` para cargar datos de ejemplo).
 * Levanta PostgreSQL real (embedded-postgres), migra y arranca la aplicación. Sin datos de ejemplo, la primera vez
 * se entra a /instalacion para crear la organización y el administrador.
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
  if (process.argv.includes("--ejemplo")) process.env.CARGAR_DATOS_EJEMPLO = "si";
  process.env.SESSION_SECRET ??= "local-no-usar-en-produccion-000000000000";
  process.env.CODIGO_INSTALACION ??= "instalacion-local-0001";
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
  console.log(process.env.CARGAR_DATOS_EJEMPLO === "si" ? "\nAplicación en http://localhost:3000 con datos de ejemplo (usuarios @demo.local, contraseña Demo-2026!)" : `\nAplicación en http://localhost:3000 · primera vez: http://localhost:3000/instalacion (código ${process.env.CODIGO_INSTALACION})`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
