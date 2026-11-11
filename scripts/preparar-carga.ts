/**
 * Prepara las pruebas de carga con k6: crea sesiones válidas para el usuario de producción DEMO y escribe
 * .herramientas/carga.json con las cookies, los tokens CSRF y los identificadores que usan los escenarios.
 * Uso: DATABASE_URL=... tsx scripts/preparar-carga.ts [cantidad]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { sha256, tokenAleatorio } from "../src/shared/aplicacion/cripto";

async function principal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const cantidad = Number(process.argv[2] ?? 60);
  const c = new Client({ connectionString: url });
  await c.connect();
  const u = (await c.query("SELECT id FROM usuario WHERE correo = 'produccion@demo.local'")).rows[0];
  const ids = (
    await c.query(`SELECT f.id AS finca, l.id AS lote, b.id AS bodega, p.id AS producto, (SELECT id FROM unidad WHERE codigo = 'kg') AS unidad
                     FROM finca f JOIN lote l ON l.finca_id = f.id AND l.codigo = 'L-01' JOIN bodega b ON b.finca_id = f.id JOIN producto p ON p.codigo = 'CER'
                    WHERE f.nombre LIKE '%Mirador%' LIMIT 1`)
  ).rows[0];
  const sesiones: { cookie: string; csrf: string }[] = [];
  for (let i = 0; i < cantidad; i++) {
    const token = tokenAleatorio();
    const csrf = tokenAleatorio(16);
    await c.query("INSERT INTO sesion (token_hash, usuario_id, expira_en, csrf_token) VALUES ($1,$2, now() + interval '3 hours', $3)", [sha256(token), u.id, csrf]);
    sesiones.push({ cookie: token, csrf });
  }
  await c.end();
  mkdirSync(".herramientas", { recursive: true });
  writeFileSync(".herramientas/carga.json", JSON.stringify({ sesiones, ids }, null, 2));
  console.log(`${cantidad} sesiones de carga creadas en .herramientas/carga.json`);
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
