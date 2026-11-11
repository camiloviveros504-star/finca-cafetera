// QA-11 · Estrés por escalones: 50, 100, 200, 400 y 800 usuarios virtuales, 45 s cada uno, sin pausa de espera.
// Cada escalón lleva su etiqueta para leer latencias y errores por separado. Uso: k6 run pruebas-carga/estres.js
import { iteracion } from "./comun.js";

const ESCALONES = [50, 100, 200, 400, 800];
const scenarios = {};
const thresholds = {};
ESCALONES.forEach((vus, i) => {
  scenarios[`e${vus}`] = { executor: "constant-vus", vus, duration: "45s", startTime: `${i * 50}s`, exec: `escalon${vus}` };
  // Umbrales siempre verdaderos: solo sirven para que k6 incluya las métricas por escalón en el resumen.
  thresholds[`http_req_duration{etapa:${vus}}`] = ["max>=0"];
  thresholds[`http_req_failed{etapa:${vus}}`] = ["rate>=0"];
  thresholds[`http_reqs{etapa:${vus}}`] = ["count>=0"];
});
export const options = { scenarios, thresholds };

export function escalon50() { iteracion("50"); }
export function escalon100() { iteracion("100"); }
export function escalon200() { iteracion("200"); }
export function escalon400() { iteracion("400"); }
export function escalon800() { iteracion("800"); }

export function handleSummary(datos) {
  return { "docs/pruebas/resultados/k6-qa-11.json": JSON.stringify(datos, null, 2), stdout: "" };
}
