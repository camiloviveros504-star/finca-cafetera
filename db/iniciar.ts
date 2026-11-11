/** Migra y, si la base está vacía y SEMBRAR_DEMO=si, siembra los datos DEMO. Lo usa el contenedor al arrancar. */
import { conectar } from "./conexion";
import { migrar } from "./migrador";
import { sembrar } from "./semilla";

export async function prepararBase(url?: string): Promise<void> {
  const c = await conectar(url);
  try {
    const aplicadas = await migrar(c);
    if (aplicadas.length) console.log(`Migraciones aplicadas: ${aplicadas.join(", ")}`);
    if (process.env.SEMBRAR_DEMO === "si") {
      const hay = await c.query("SELECT count(*)::int AS n FROM organizacion");
      if (hay.rows[0].n === 0) {
        await sembrar(c);
        console.log("Datos DEMO sembrados");
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
