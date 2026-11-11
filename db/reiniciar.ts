import { conectar } from "./conexion";
import { migrar } from "./migrador";
import { sembrar } from "./semilla";

/** Borra todo el esquema public, migra y siembra los datos DEMO. Reproducible (QA-14). */
async function principal() {
  if (process.env.NODE_ENV === "production" && process.env.PERMITIR_RESET !== "si") {
    throw new Error("Reinicio bloqueado en producción. Defina PERMITIR_RESET=si si es intencional.");
  }
  const cliente = await conectar();
  try {
    await cliente.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const aplicadas = await migrar(cliente);
    console.log(`Migraciones: ${aplicadas.join(", ")}`);
    await sembrar(cliente);
    console.log("Datos DEMO sembrados");
  } finally {
    await cliente.end();
  }
}

principal().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
