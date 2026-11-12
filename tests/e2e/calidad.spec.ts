import { writeFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const CLAVE = "Demo-2026!";
const guardar = (id: string, datos: Record<string, unknown>) => {
  if (process.env.GUARDAR_RESULTADOS !== "si") return;
  mkdirSync("docs/pruebas/resultados", { recursive: true });
  writeFileSync(`docs/pruebas/resultados/${id}.json`, JSON.stringify({ id, fecha: new Date().toISOString(), entorno: process.env.ENTORNO_PRUEBA ?? "App en Docker (local) + Chrome instalado", comando: "npx playwright test tests/e2e/calidad.spec.ts", ...datos }, null, 2) + "\n");
};

async function entrar(page: Page, correo: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL("**/inicio");
}

async function bd() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
}

test("QA-08 · 50 cosechas sin señal se sincronizan solas en ≤ 60 s, sin pérdidas ni duplicados", async ({ page, context }) => {
  const c = await bd();
  const ids = (await c.query(`SELECT f.id AS finca, l.id AS lote, b.id AS bodega, p.id AS producto, (SELECT id FROM unidad WHERE codigo = 'kg') AS unidad
                                FROM finca f JOIN lote l ON l.finca_id = f.id AND l.codigo = 'L-03' JOIN bodega b ON b.finca_id = f.id JOIN producto p ON p.codigo = 'CER'
                               WHERE f.nombre LIKE '%Mirador%' LIMIT 1`)).rows[0];
  const antes = (await c.query("SELECT count(*)::int AS n FROM cosecha WHERE lote_id = $1", [ids.lote])).rows[0].n;
  await entrar(page, "produccion@demo.local");
  await page.goto("/cosechas/nueva");
  await context.setOffline(true);
  // Se guardan 50 operaciones en la cola local (IndexedDB) exactamente con la forma que usa el formulario.
  await page.evaluate(async (d) => {
    const abrir = () => new Promise<IDBDatabase>((ok, mal) => { const r = indexedDB.open("finca-cola", 1); r.onupgradeneeded = () => r.result.createObjectStore("operaciones", { keyPath: "id" }); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
    const bdl = await abrir();
    await new Promise<void>((ok, mal) => {
      const tx = bdl.transaction("operaciones", "readwrite");
      for (let i = 0; i < 50; i++) {
        tx.objectStore("operaciones").put({
          id: crypto.randomUUID(), tipo: "cosecha", estado: "pendiente", resumen: `Prueba ${i}`, creadaEn: new Date(Date.now() + i).toISOString(), intentos: 0, proximoIntento: 0,
          payload: { fincaId: d.finca, loteId: d.lote, bodegaId: d.bodega, productoId: d.producto, unidadId: d.unidad, fecha: new Date().toISOString().slice(0, 10), cantidad: "1", capturadaEn: new Date().toISOString(), claveIdempotencia: "" },
        });
      }
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
  }, ids);
  await page.evaluate(() => window.dispatchEvent(new Event("finca-sincronizar"))); // refresca la cola en pantalla (sin red no llega nada al servidor)
  await expect(page.getByTestId("indicador-sync")).toContainText("50 pendientes");
  const enBd = (await c.query("SELECT count(*)::int AS n FROM cosecha WHERE lote_id = $1", [ids.lote])).rows[0].n;
  expect(enBd).toBe(antes); // mientras no hay red, nada llegó al servidor: sigue pendiente, nunca "confirmada"
  const t0 = Date.now();
  await context.setOffline(false);
  // Cuando todo se envió, el aviso desaparece (con conexión y sin pendientes no se muestra nada).
  await expect(page.getByTestId("indicador-sync")).toHaveCount(0, { timeout: 60_000 });
  const segundos = (Date.now() - t0) / 1000;
  const despues = (await c.query("SELECT count(*)::int AS n, count(DISTINCT clave_idempotencia)::int AS distintas FROM cosecha WHERE lote_id = $1", [ids.lote])).rows[0];
  expect(despues.n - antes).toBe(50);
  expect(despues.distintas).toBe(despues.n);
  guardar("qa-08", { operaciones: 50, sincronizadasEnSegundos: Number(segundos.toFixed(1)), perdidas: 50 - (despues.n - antes), duplicados: despues.n - despues.distintas, meta: "≤ 60 s" });
  await c.end();
  expect(segundos).toBeLessThanOrEqual(60);
});

test("QA-15 · registrar la cosecha del día: ≤ 4 pasos, ≤ 60 s y botones de al menos 44 × 44 px", async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await contexto.newPage();
  await entrar(page, "produccion@demo.local");
  await page.goto("/cosechas/nueva");
  const t0 = Date.now();
  const medidas: { nombre: string; ancho: number; alto: number }[] = [];
  const medir = async () => {
    for (const b of await page.locator("main button:visible, main select:visible, main input:visible").all()) {
      const caja = await b.boundingBox();
      if (caja) medidas.push({ nombre: (await b.getAttribute("name")) ?? (await b.innerText().catch(() => "")) ?? "", ancho: caja.width, alto: caja.height });
    }
  };
  await page.getByLabel("Lote de origen").selectOption({ index: 1 });
  await medir();
  await page.getByRole("button", { name: "Continuar" }).click(); // paso 1 → 2
  await medir();
  await page.getByRole("button", { name: "Continuar" }).click(); // paso 2 → 3
  await page.getByLabel("Cantidad", { exact: true }).fill("12");
  await medir();
  await page.getByRole("button", { name: "Continuar" }).click(); // paso 3 → 4
  await expect(page.getByText("Paso 4 de 4")).toBeVisible();
  await medir();
  await page.getByRole("button", { name: "Guardar cosecha" }).click();
  await expect(page.getByText(/Cosecha guardada/)).toBeVisible();
  const segundos = (Date.now() - t0) / 1000;
  const pequenos = medidas.filter((m) => m.alto < 44 || m.ancho < 44);
  guardar("qa-15", { pasos: 4, segundosAutomatizado: Number(segundos.toFixed(1)), elementosInteractivosMedidos: medidas.length, menoresDe44px: pequenos.length, detalleMenores: pequenos.slice(0, 5), nota: "Tiempo medido con automatización (sin lectura humana); la meta ≤ 60 s para una persona se confirma con prueba de usuario, no medida aquí." });
  expect(segundos).toBeLessThanOrEqual(60);
  expect(pequenos).toEqual([]);
  await contexto.close();
});

test("reportes CSV: el comercial descarga ventas; el encargado de producción recibe 403 (sin permiso de ventas)", async ({ browser }) => {
  const com = await (await browser.newContext()).newPage();
  await entrar(com, "comercial@demo.local");
  const ok = await com.request.get("/api/reportes/ventas");
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("text/csv");
  expect(await ok.text()).toContain("comprobante,fecha,finca,cliente,estado,total");
  const prod = await (await browser.newContext()).newPage();
  await entrar(prod, "produccion@demo.local");
  expect((await prod.request.get("/api/reportes/ventas")).status()).toBe(403);
  expect((await prod.request.get("/api/reportes/inventario")).status()).toBe(200);
});

test.describe("flujos de extensiones", () => {
  test("el recolector registra producción (sin pantalla de valores), el supervisor la valida y el sistema calcula el valor", async ({ browser }) => {
    const c = await bd();
    const rec = await (await browser.newContext()).newPage();
    await entrar(rec, "recolector@demo.local");
    await expect(rec.getByRole("link", { name: "Ventas" })).toHaveCount(0);
    await rec.goto("/trabajo");
    await rec.getByLabel("Cantidad", { exact: true }).fill("80");
    await rec.getByRole("button", { name: "Guardar registro" }).click();
    await expect(rec.getByText(/Guardado/)).toBeVisible();
    await expect.poll(async () => (await c.query("SELECT count(*)::int AS n FROM registro_trabajo WHERE estado = 'pendiente' AND cantidad_declarada = 80")).rows[0].n, { timeout: 30_000 }).toBeGreaterThan(0);
    const sup = await (await browser.newContext()).newPage();
    await entrar(sup, "supervisor@demo.local");
    await sup.goto("/trabajo");
    await sup.locator("li", { hasText: "Declarado: 80" }).getByRole("button", { name: "Validar" }).first().click();
    // Al validar, la lista se recarga y la fila deja de mostrar el formulario: se comprueba el resultado en la base.
    await expect.poll(async () => Number((await c.query("SELECT valor_calculado FROM registro_trabajo WHERE estado = 'validado' AND cantidad_validada = 80 LIMIT 1")).rows[0]?.valor_calculado ?? 0), { timeout: 15_000 }).toBe(120000);
    await c.end();
  });

  test("financiero, administrador y auditor ven sus módulos; el comercial no ve finanzas ni usuarios", async ({ browser }) => {
    for (const [correo, rutas, ausentes] of [
      ["financiero@demo.local", ["/finanzas", "/compras", "/liquidaciones", "/cartera"], []],
      ["admin@demo.local", ["/fincas", "/usuarios", "/auditoria", "/lotes", "/cosechas", "/inventario", "/ventas", "/finanzas"], []],
      ["auditor@demo.local", ["/auditoria", "/finanzas"], []],
      ["comercial@demo.local", ["/cartera"], ["/finanzas", "/usuarios"]],
    ] as [string, string[], string[]][]) {
      const page = await (await browser.newContext()).newPage();
      await entrar(page, correo);
      for (const r of rutas) {
        const resp = await page.goto(r);
        expect(resp?.status(), `${correo} ${r}`).toBe(200);
        await expect(page.locator("main [role=alert]"), `${correo} ${r}`).toHaveCount(0);
      }
      for (const r of ausentes) {
        await page.goto(r);
        await expect(page.locator("main [role=alert]"), `${correo} ${r}`).toContainText("No tiene permiso");
      }
    }
  });
});
