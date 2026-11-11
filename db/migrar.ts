import { conectar } from "./conexion";
import { migrar } from "./migrador";

async function principal() {
  const cliente = await conectar();
  try {
    const aplicadas = await migrar(cliente);
    console.log(aplicadas.length ? `Migraciones aplicadas: ${aplicadas.join(", ")}` : "Sin migraciones pendientes");
  } finally {
    await cliente.end();
  }
}

principal().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
