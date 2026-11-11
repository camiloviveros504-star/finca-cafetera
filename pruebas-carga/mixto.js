// QA-10 · 50 usuarios simultáneos, uso mixto 70 % lecturas / 30 % escrituras durante 10 minutos.
// Uso: k6 run pruebas-carga/mixto.js   (APP_URL, DURACION y COOKIE opcionales)
import { iteracion } from "./comun.js";

export const options = {
  scenarios: { mixto: { executor: "constant-vus", vus: 50, duration: __ENV.DURACION || "10m" } },
  thresholds: {
    "http_req_duration{tipo:lectura}": ["p(95)<800"],
    "http_req_duration{tipo:escritura}": ["p(95)<1500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function escenarioMixto() {
  iteracion("mixto");
}

export function handleSummary(datos) {
  datos.fecha = new Date().toISOString();
  return { "docs/pruebas/resultados/k6-qa-10.json": JSON.stringify(datos, null, 2), stdout: "" };
}
