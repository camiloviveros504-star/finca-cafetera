/**
 * Migra la base. Por defecto NO siembra nada: la primera organización y su administrador se crean en /instalacion.
 * Solo si se pide expresamente (CARGAR_DATOS_EJEMPLO=si) y la base está vacía, carga un conjunto de datos de ejemplo marcado DEMO.
 */
import { conectar } from "./conexion";
import { migrar } from "./migrador";
import { sembrar } from "./semilla";

export async function prepararBase(url?: string): Promise<void> {
  const c = await conectar(url);
  try {
    const aplicadas = await migrar(c);
    if (aplicadas.length) console.log(`Migraciones aplicadas: ${aplicadas.join(", ")}`);
    if (process.env.CARGAR_DATOS_EJEMPLO === "si") {
      const hay = await c.query("SELECT count(*)::int AS n FROM organizacion");
      if (hay.rows[0].n === 0) {
        await sembrar(c);
        console.log("Datos de ejemplo (DEMO) cargados");
      }
    }
  } finally {
    await c.end();
  }
}

if (require.main === module) {
  prepararBase().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
