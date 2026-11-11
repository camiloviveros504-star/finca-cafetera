/** Genera docs/modelo-datos/matriz-rol-permiso.md desde la base. */
import { writeFileSync } from "node:fs";
import { conectar } from "./conexion";

async function principal() {
  const c = await conectar();
  try {
    const roles = (await c.query("SELECT id, codigo, nombre FROM rol ORDER BY es_extension, codigo")).rows;
    const permisos = (await c.query("SELECT id, codigo, descripcion FROM permiso ORDER BY codigo")).rows;
    const rp = new Set((await c.query("SELECT rol_id || ':' || permiso_id AS k FROM rol_permiso")).rows.map((r) => r.k));
    let md = "# Matriz rol-permiso\n\n> Generada con `npx tsx db/matriz.ts` desde la base. Los permisos se comprueban en el servidor, en la capa de aplicación de cada caso de uso.\n\n";
    md += `| Permiso | ${roles.map((r) => r.nombre).join(" | ")} |\n|---|${roles.map(() => ":-:").join("|")}|\n`;
    for (const p of permisos) md += `| \`${p.codigo}\` · ${p.descripcion} | ${roles.map((r) => (rp.has(`${r.id}:${p.id}`) ? "✔" : "")).join(" | ")} |\n`;
    md += "\nAdemás del permiso, todo acceso se limita por **organización** y por las **fincas asignadas** al usuario (`usuario_finca`). Se pueden dar permisos extra a un usuario concreto (`usuario_permiso_extra`).\n";
    md += "\nRoles de extensión (supervisor de campo, recolector, bodega, financiero, auditor): diseñados en el prompt maestro; su estado de implementación se indica en la matriz de trazabilidad.\n";
    writeFileSync("docs/modelo-datos/matriz-rol-permiso.md", md);
    console.log("Matriz generada");
  } finally {
    await c.end();
  }
}
principal();
