// Genera docs/pruebas/informe-de-pruebas.md SOLO con valores medidos: lee docs/pruebas/resultados/*.json (escritos por las
// pruebas con GUARDAR_RESULTADOS=si) y los reportes JSON de vitest y Playwright. Si falta un archivo, lo dice; no inventa.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const R = "docs/pruebas/resultados";
const leer = (n) => {
  if (!existsSync(`${R}/${n}`)) return null;
  const j = JSON.parse(readFileSync(`${R}/${n}`, "utf8"));
  if (j.startTime && !j.fecha) j.fecha = new Date(j.startTime).toISOString(); // vitest
  if (j.stats?.startTime && !j.fecha) j.fecha = j.stats.startTime; // Playwright
  return j;
};
const fmtFecha = (f) => (f ? f.replace("T", " ").slice(0, 16) + " UTC" : "—");

// Pruebas automatizadas (vitest y Playwright) agrupadas por la etiqueta QA que llevan en el título.
function titulosVitest() {
  const j = leer("vitest.json");
  if (!j) return [];
  return j.testResults.flatMap((f) => f.assertionResults.map((a) => ({ titulo: a.fullName, estado: a.status })));
}
function titulosPlaywright() {
  const j = leer("playwright.json");
  if (!j) return [];
  const salida = [];
  const recorrer = (s, prefijo) => {
    for (const sub of s.suites ?? []) recorrer(sub, `${prefijo} ${sub.title}`);
    for (const sp of s.specs ?? []) salida.push({ titulo: `${prefijo} ${sp.title}`, estado: sp.ok ? "passed" : "failed" });
  };
  for (const s of j.suites) recorrer(s, s.title);
  return salida;
}
const todos = [...titulosVitest(), ...titulosPlaywright()];
const resumenTests = (re) => {
  const t = todos.filter((x) => re.test(x.titulo));
  return { total: t.length, ok: t.filter((x) => x.estado === "passed").length };
};
const cumple = (ok) => (ok ? "Sí" : "No");

const filas = [];
const fila = (id, atributo, meta, obtenido, entorno, fecha, comando, ok) => filas.push({ id, atributo, meta, obtenido, entorno, fecha, comando, ok });

const q1 = leer("qa-01.json");
fila("QA-01", "D1 Consistencia", "0 saldos negativos en 1.000 ejecuciones concurrentes; confirmar/rechazar ≤ 1,5 s (p95)",
  q1 ? `${q1.rondas} rondas × ${q1.solicitudesPorRonda} solicitudes = ${q1.solicitudesTotales}: ${q1.confirmadas} confirmadas, ${q1.rechazadas} rechazadas, ${q1.saldosNegativos} saldos negativos; p95 ${q1.p95Ms} ms` : "SIN MEDIR", q1?.entorno ?? "—", fmtFecha(q1?.fecha), q1?.comando ?? "—", q1 && q1.saldosNegativos === 0 && q1.rondas >= 1000 && q1.p95Ms <= 1500);
const q2 = leer("qa-02.json");
fila("QA-02", "D1 Idempotencia", "0 duplicados en 500 reintentos; respuesta al reintento ≤ 1 s (p95)",
  q2 ? `${q2.reintentos} reintentos de ${q2.ventasDistintas} ventas: ${q2.duplicados} duplicados; p95 ${q2.p95Ms} ms` : "SIN MEDIR", q2?.entorno ?? "—", fmtFecha(q2?.fecha), q2?.comando ?? "—", q2 && q2.duplicados === 0 && q2.p95Ms <= 1000);
const q3 = leer("qa-03.json");
fila("QA-03", "D2 Trazabilidad", "100 % de ventas con lote; consulta ≤ 2 s (p95) con 100.000 movimientos y 10.000 cosechas",
  q3 ? `${q3.movimientos} movimientos, ${q3.cosechas} cosechas, ${q3.ventas} ventas; ventas sin lote: ${q3.ventasSinLote}; ${q3.consultas} consultas: p50 ${q3.p50Ms} ms, p95 ${q3.p95Ms} ms, máx ${q3.maxMs} ms` : "SIN MEDIR", q3?.entorno ?? "—", fmtFecha(q3?.fecha), q3?.comando ?? "—", q3 && q3.ventasSinLote === 0 && q3.p95Ms <= 2000 && q3.movimientos >= 100000 && q3.cosechas >= 10000);
for (const [id, atributo, meta, re] of [
  ["QA-04", "D2 Integridad cosecha-lote", "100 % de rechazos; 0 cosechas huérfanas", /QA-04/],
  ["QA-05", "D3 Autorización en servidor", "100 % de rechazos (403) y auditoría escrita", /QA-05/],
  ["QA-06", "D3 Fuerza bruta", "Bloqueo tras ≤ 5 fallos en 15 min; 0 mensajes que revelen si el usuario existe", /QA-06/],
  ["QA-07", "D3 Aislamiento entre fincas", "0 registros de otra finca en la batería", /QA-07/],
  ["QA-12", "Modificabilidad (tarifas)", "Cambio sin desplegar código; 0 registros históricos alterados", /QA-12/],
]) {
  const t = resumenTests(re);
  fila(id, atributo, meta, t.total ? `${t.ok} de ${t.total} pruebas automatizadas pasan` : "SIN PRUEBAS EN EL REPORTE", "PostgreSQL 16 en Docker (local)", fmtFecha(leer("vitest.json")?.fecha), "vitest run", t.total > 0 && t.ok === t.total);
}
const q8 = leer("qa-08.json");
fila("QA-08", "Conectividad limitada", "0 pérdidas y 0 duplicados; 50 registros sincronizados ≤ 60 s tras reconectar",
  q8 ? `${q8.operaciones} operaciones: ${q8.perdidas} pérdidas, ${q8.duplicados} duplicados, sincronizadas en ${q8.sincronizadasEnSegundos} s (red local, no 3G)` : "SIN MEDIR", q8?.entorno ?? "—", fmtFecha(q8?.fecha), q8?.comando ?? "—", q8 && q8.perdidas === 0 && q8.duplicados === 0 && q8.sincronizadasEnSegundos <= 60);
const q9 = leer("qa-09.json");
fila("QA-09", "Rendimiento de interfaz", "LCP ≤ 2,5 s, CLS < 0,1; Lighthouse móvil Rendimiento ≥ 85 y Accesibilidad ≥ 95",
  q9 ? q9.resumen : "SIN MEDIR", q9?.entorno ?? "—", fmtFecha(q9?.fecha), q9?.comando ?? "—", q9?.cumple ?? false);
const k10 = leer("k6-qa-10.json");
if (k10) {
  const m = k10.metrics;
  const lec = m["http_req_duration{tipo:lectura}"]?.values?.["p(95)"];
  const esc = m["http_req_duration{tipo:escritura}"]?.values?.["p(95)"];
  const fallos = m.http_req_failed?.values?.rate;
  const reqs = m.http_reqs?.values;
  fila("QA-10", "Rendimiento de servidor", "50 usuarios, 10 min, 70/30: lecturas ≤ 800 ms y escrituras ≤ 1,5 s (p95); errores < 1 %",
    `${reqs.count} solicitudes (${reqs.rate.toFixed(0)}/s); lecturas p95 ${lec?.toFixed(0)} ms; escrituras p95 ${esc?.toFixed(0)} ms; errores ${(fallos * 100).toFixed(2)} %`, "App en Docker (local, pool PG de 5) + PostgreSQL 16 en Docker; NO es Vercel + Render", fmtFecha(k10.fecha ?? null), "k6 run pruebas-carga/mixto.js", lec <= 800 && esc <= 1500 && fallos < 0.01);
} else fila("QA-10", "Rendimiento de servidor", "50 usuarios, 10 min, 70/30", "SIN MEDIR", "—", "—", "—", false);
const k11 = leer("k6-qa-11.json");
const q11 = leer("qa-11.json");
if (k11 && q11) {
  const m = k11.metrics;
  const lineas = [50, 100, 200, 400, 800].map((v) => {
    const d = m[`http_req_duration{etapa:${v}}`]?.values;
    const f = m[`http_req_failed{etapa:${v}}`]?.values?.rate;
    const n = m[`http_reqs{etapa:${v}}`]?.values?.count;
    return d ? `${v} VU: ${n} sol., p95 ${d["p(95)"].toFixed(0)} ms, errores ${(f * 100).toFixed(1)} %` : `${v} VU: sin datos`;
  });
  fila("QA-11", "Escalabilidad (estrés)", "Documentar el punto de quiebre y el primer componente que falla; 0 saldos negativos",
    `${lineas.join(" · ")}. Saldos negativos tras el estrés: ${q11.saldosNegativos}. ${q11.conclusion}`, "App en Docker (local) + PostgreSQL 16 en Docker; NO es Vercel + Render", fmtFecha(q11.fecha), "k6 run pruebas-carga/estres.js", q11.saldosNegativos === 0);
} else fila("QA-11", "Escalabilidad (estrés)", "Documentar el punto de quiebre", "SIN MEDIR", "—", "—", "—", false);
const q13 = leer("qa-13.json");
fila("QA-13", "Mantenibilidad", "100 % de violaciones de capas detectadas antes de fusionar",
  q13 ? q13.resultado : "SIN MEDIR", "Local y CI (GitHub Actions)", fmtFecha(q13?.fecha), "node scripts/probar-capas.mjs", q13?.cumple ?? false);
const q14 = leer("qa-14.json");
fila("QA-14", "Recuperabilidad", "Recreación completa de la BD ≤ 15 min siguiendo docs/despliegue.md",
  q14 ? q14.resumen : "SIN MEDIR", q14?.entorno ?? "—", fmtFecha(q14?.fecha), q14?.comando ?? "—", q14?.cumple ?? false);
const q15 = leer("qa-15.json");
fila("QA-15", "Usabilidad en campo", "≤ 60 s y ≤ 4 pasos; botones ≥ 44 × 44 px",
  q15 ? `${q15.pasos} pasos; ${q15.segundosAutomatizado} s con automatización (no sustituye una prueba con personas); ${q15.menoresDe44px} de ${q15.elementosInteractivosMedidos} elementos interactivos menores de 44 px` : "SIN MEDIR", q15?.entorno ?? "—", fmtFecha(q15?.fecha), q15?.comando ?? "—", q15 && q15.pasos <= 4 && q15.menoresDe44px === 0);
const resp = resumenTests(/sin scroll horizontal/);
fila("QA-16", "Responsive", "0 desbordes horizontales en 5 tamaños × flujos clave",
  resp.total ? `${resp.ok} de ${resp.total} combinaciones tamaño × pantalla sin desborde (capturas en test-results/capturas; no se versionan)` : "SIN PRUEBAS EN EL REPORTE", "Chrome instalado, 5 tamaños de la sección 15.4", fmtFecha(leer("playwright.json")?.fecha), "npx playwright test tests/e2e/responsive.spec.ts", resp.total > 0 && resp.ok === resp.total);

const sinMedir = filas.filter((f) => f.obtenido.startsWith("SIN")).map((f) => f.id);
const md = `# Informe de pruebas

Generado por \`node scripts/generar-informe.mjs\` a partir de mediciones guardadas en \`docs/pruebas/resultados/\`. **Solo se reporta lo ejecutado**, con fecha, entorno y comando. Una celda "SIN MEDIR" significa que esa medición no se ha hecho.

> **Entorno de referencia del prompt:** Vercel Hobby + Render Free. Salvo que la fila diga otra cosa, las mediciones de esta versión se hicieron **en local sobre Docker** (PostgreSQL 16) porque el despliegue aún no estaba hecho. Los números locales **no** son los de Vercel + Render: allá se espera más latencia (red entre regiones, arranque en frío, pool pequeño). Cuando se mida allá se agrega una columna.

| ID | Atributo | Meta | Valor obtenido | Entorno | Fecha | Comando | ¿Cumple? |
|---|---|---|---|---|---|---|---|
${filas.map((f) => `| ${f.id} | ${f.atributo} | ${f.meta} | ${f.obtenido} | ${f.entorno} | ${f.fecha} | \`${f.comando}\` | **${cumple(f.ok)}** |`).join("\n")}

${sinMedir.length ? `**Sin medir todavía:** ${sinMedir.join(", ")}.\n` : ""}
## Notas de interpretación
- "Cumple" compara el valor obtenido con la meta de diseño del prompt §17.1; no es una garantía para otros entornos.
- Arranque en frío vs. caliente: las medidas locales son en caliente. La medición en Vercel + Render debe reportar ambos por separado.
- QA-15 mide los pasos y el tamaño de los botones; el tiempo de 60 s está medido con automatización y debe confirmarse con una prueba con una persona real.
- QA-08 se midió en red local; la meta habla de 3G, que no se simuló.
`;
writeFileSync("docs/pruebas/informe-de-pruebas.md", md);
console.log(`Informe generado (${filas.length} escenarios; sin medir: ${sinMedir.join(", ") || "ninguno"}).`);
