/** Genera docs/modelo-datos/diccionario-de-datos.md desde el esquema real (information_schema). */
import { writeFileSync, mkdirSync } from "node:fs";
import { conectar } from "./conexion";

async function principal() {
  const c = await conectar();
  try {
    const tablas = (
      await c.query<{ t: string }>(
        "SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'migracion' ORDER BY 1",
      )
    ).rows.map((r) => r.t);
    let md = "# Diccionario de datos\n\n> Generado con `npx tsx db/diccionario.ts` desde el esquema real de PostgreSQL. No se edita a mano.\n\n";
    md += `Tablas: ${tablas.length}. Montos \`numeric(14,2)\`, cantidades \`numeric(14,3)\`, fechas \`timestamptz\`, claves primarias \`uuid\`.\n\n`;
    for (const t of tablas) {
      const cols = await c.query(
        `SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
         FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [t],
      );
      const cons = await c.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conrelid = ('public.' || quote_ident($1))::regclass ORDER BY contype, conname`,
        [t],
      );
      const idx = await c.query(
        "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 AND indexname NOT IN (SELECT conname FROM pg_constraint) ORDER BY 1",
        [t],
      );
      md += `## ${t}\n\n| Columna | Tipo | Nulo | Por defecto |\n|---|---|---|---|\n`;
      for (const col of cols.rows) {
        const tipo = col.numeric_precision && col.data_type === "numeric" ? `numeric(${col.numeric_precision},${col.numeric_scale})` : col.data_type;
        md += `| ${col.column_name} | ${tipo} | ${col.is_nullable === "YES" ? "sí" : "no"} | ${col.column_default ? "`" + String(col.column_default).replace(/\|/g, "\\|") + "`" : ""} |\n`;
      }
      md += "\nRestricciones:\n\n";
      for (const k of cons.rows) md += `- \`${k.conname}\`: ${String(k.def).replace(/\|/g, "\\|")}\n`;
      if (idx.rows.length) {
        md += "\nÍndices:\n\n";
        for (const i of idx.rows) md += `- \`${i.indexdef}\`\n`;
      }
      md += "\n";
    }
    mkdirSync("docs/modelo-datos", { recursive: true });
    writeFileSync("docs/modelo-datos/diccionario-de-datos.md", md);
    console.log(`Diccionario generado: ${tablas.length} tablas`);
  } finally {
    await c.end();
  }
}
principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
