// QA-13 · Demuestra que la verificación de capas detecta un atajo: crea a propósito un archivo de presentación que
// importa infraestructura, ejecuta dependency-cruiser y exige que falle nombrando la regla violada. Luego lo borra.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const archivo = "src/app/_violacion_de_prueba.ts";
writeFileSync(archivo, 'import { RepositorioVentasPg } from "@/modules/comercial/infrastructure/repositorioVentasPg";\nexport const atajo = RepositorioVentasPg;\n');
try {
  const r = spawnSync("npx", ["depcruise", "src", "--config", ".dependency-cruiser.cjs"], { encoding: "utf8", shell: true });
  const salida = `${r.stdout}${r.stderr}`;
  const detectada = r.status !== 0 && salida.includes("presentacion-no-toca-infraestructura") && salida.includes("_violacion_de_prueba");
  console.log(detectada ? "QA-13 OK: el atajo presentación → infraestructura fue detectado (regla presentacion-no-toca-infraestructura) y el comando falló como debe." : "QA-13 FALLA: la violación NO fue detectada.");
  if (!detectada) console.log(salida.slice(0, 1500));
  if (process.env.GUARDAR_RESULTADOS === "si") {
    mkdirSync("docs/pruebas/resultados", { recursive: true });
    writeFileSync("docs/pruebas/resultados/qa-13.json", JSON.stringify({ id: "qa-13", fecha: new Date().toISOString(), resultado: detectada ? "Se creó a propósito un import presentación → infraestructura; dependency-cruiser falló nombrando la regla presentacion-no-toca-infraestructura (1 de 1 violaciones detectadas)" : "La violación no fue detectada", cumple: detectada }, null, 2) + "\n");
  }
  process.exitCode = detectada ? 0 : 1;
} finally {
  rmSync(archivo, { force: true });
}
