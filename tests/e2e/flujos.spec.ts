import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

const CLAVE = "Demo-2026!";

/** Llena la venta por tipo de café: tipo, kilos y precio por kilo (el precio lo fija quien vende). */
async function llenarVenta(page: Page, kg: string) {
  await page.locator('select[name="clienteId"]').selectOption({ index: 1 });
  await page.locator('select[name="productoId1"]').selectOption({ label: "Pergamino seco DEMO" });
  await page.locator('input[name="kg1"]').fill(kg);
  await page.locator('input[name="precio1"]').fill("10000");
}

async function entrar(page: Page, correo: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL("**/inicio");
}

test.describe("flujos con roles", () => {
  test("responsable comercial: inicia sesión, registra una venta y ve su trazabilidad", async ({ page }) => {
    await entrar(page, "comercial@demo.local");
    await expect(page.getByRole("link", { name: "Ventas" }).first()).toBeVisible();
    await page.goto("/ventas/nueva");
    await llenarVenta(page, "1");
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await page.waitForURL("**/trazabilidad/**");
    await expect(page.getByText("Lote de origen").first()).toBeVisible();
    await expect(page.getByText(/Cosechas del lote/).first()).toBeVisible();
  });

  test("una venta mayor que las existencias se rechaza con mensaje claro", async ({ page }) => {
    await entrar(page, "comercial@demo.local");
    await page.goto("/ventas/nueva");
    await llenarVenta(page, "999999");
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Existencias insuficientes");
  });

  test("administrador de la plataforma: da de alta una finca con su propietario y su menú no trae lo operativo", async ({ page }) => {
    await entrar(page, "admin@demo.local");
    const menu = page.getByRole("navigation", { name: "Principal" }).first();
    await expect(menu.getByRole("link", { name: "Fincas" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Compra de insumos" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Insumos" })).toHaveCount(0);
    await page.goto("/fincas");
    const nombre = `Finca E2E ${Date.now()}`;
    const dueno = `Dueño ${Date.now()}`;
    const nueva = page.locator("section", { hasText: "Nueva finca" });
    await nueva.locator('input[name="nombre"]').fill(nombre);
    await nueva.locator('input[name="areaHa"]').fill("7.5");
    await nueva.locator('input[name="propietarioNuevo"]').check();
    await nueva.locator('input[name="propietarioNombre"]').fill(dueno);
    await nueva.locator('input[name="propietarioCorreo"]').fill(`dueno.${Date.now()}@e2e.test`);
    await nueva.getByRole("button", { name: "Crear finca" }).click();
    await expect(nueva.locator('input[aria-label="Enlace de activación"]')).toBeVisible({ timeout: 15000 });
    // El propietario aparece con su finca, y la finca con su espacio para lotes.
    const tarjeta = page.locator("section", { hasText: dueno }).first();
    await expect(tarjeta.getByText(nombre)).toBeVisible();
  });

  test("propietario: ve lo operativo de su finca y no la administración de la plataforma", async ({ page }) => {
    await entrar(page, "propietario@demo.local");
    const menu = page.getByRole("navigation", { name: "Principal" }).first();
    await expect(menu.getByRole("link", { name: "Compra de insumos" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Fincas" })).toHaveCount(0);
    await page.goto("/fincas");
    await expect(page.locator("main [role=alert]")).toContainText("administrador de la plataforma");
  });

  test("propietario: crea la cuenta de su capataz; el administrador no ve formularios de capataz ni trabajador", async ({ browser }) => {
    const dueno = await (await browser.newContext()).newPage();
    await entrar(dueno, "propietario@demo.local");
    await dueno.goto("/usuarios");
    const tarjeta = dueno.locator("section", { hasText: "Cuenta de capataz" });
    await tarjeta.locator('input[name="nombre"]').fill("Capataz de Prueba");
    await tarjeta.locator('input[name="correo"]').fill(`capataz.${Date.now()}@e2e.test`);
    await tarjeta.getByRole("button", { name: "Crear y generar enlace" }).click();
    await expect(tarjeta.locator('input[aria-label="Enlace de activación"]')).toBeVisible({ timeout: 15000 });

    const admin = await (await browser.newContext()).newPage();
    await entrar(admin, "admin@demo.local");
    await admin.goto("/usuarios");
    await expect(admin.getByText("Cuenta de capataz")).toHaveCount(0);
    await expect(admin.locator("option", { hasText: /^Capataz$/ })).toHaveCount(0);
  });

  test("plagas: el propietario reporta roya en un lote, la ve activa y la marca como controlada", async ({ page }) => {
    await entrar(page, "propietario@demo.local");
    await page.goto("/sanidad?ver=sanidad");
    const reporte = page.locator("section", { hasText: "Reportar una plaga" });
    await reporte.locator('select[name="tipo"]').selectOption("roya");
    await reporte.locator('select[name="severidad"]').selectOption("alta");
    const nota = `Pústulas naranja en el envés ${Date.now()}`;
    await reporte.locator('textarea[name="descripcion"]').fill(nota);
    await reporte.getByRole("button", { name: "Reportar" }).click();
    await expect(reporte.getByText("Plaga reportada en el lote.")).toBeVisible({ timeout: 15000 });
    await page.reload();
    const caso = page.locator("div.rounded-lg", { hasText: nota }).first();
    await expect(caso.getByText("Detectada")).toBeVisible();
    await caso.getByText("Registrar avance").click();
    await caso.locator('select[name="estado"]').selectOption("controlado");
    await caso.locator('textarea[name="nota"]').fill("Se aplicó fungicida y ya no hay pústulas nuevas");
    await caso.getByRole("button", { name: "Guardar" }).click();
    // Al controlarse, el caso sale de las activas y queda en el historial de controladas.
    const controladas = page.locator("details", { hasText: /Plagas controladas/ });
    await expect(controladas.getByText(nota)).toBeAttached({ timeout: 15000 });
    await expect(controladas.locator("div.rounded-lg", { hasText: nota }).first().locator("span", { hasText: /^Controlada$/ })).toBeAttached();
  });

  test("encargado de producción: el menú no muestra Ventas y el servidor rechaza el acceso directo", async ({ page }) => {
    await entrar(page, "produccion@demo.local");
    await expect(page.getByRole("link", { name: "Ventas" })).toHaveCount(0);
    await page.goto("/ventas/nueva");
    await expect(page.locator("main [role=alert]")).toContainText("No tiene permiso");
  });

  test("QA-05: llamada directa a la API sin permiso responde 403 y queda auditada", async ({ page, request }) => {
    await entrar(page, "produccion@demo.local");
    const bd = new Client({ connectionString: process.env.DATABASE_URL });
    await bd.connect();
    const s = await bd.query(
      "SELECT s.csrf_token FROM sesion s JOIN usuario u ON u.id = s.usuario_id WHERE u.correo = 'produccion@demo.local' ORDER BY s.creada_en DESC LIMIT 1",
    );
    const csrf = s.rows[0].csrf_token as string;
    const cookies = await page.context().cookies();
    const cabecera = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const antes = await bd.query("SELECT count(*)::int AS n FROM auditoria WHERE resultado = 'denegado' AND accion = 'venta.crear'");
    const r = await request.post("/api/ventas", {
      headers: { cookie: cabecera, "x-csrf-token": csrf, "content-type": "application/json" },
      data: {
        fincaId: "00000000-0000-4000-8000-000000000000",
        clienteId: "00000000-0000-4000-8000-000000000000",
        claveIdempotencia: crypto.randomUUID(),
        items: [{ productoId: "00000000-0000-4000-8000-000000000000", cantidad: "1" }],
      },
    });
    expect(r.status()).toBe(403);
    const despues = await bd.query("SELECT count(*)::int AS n FROM auditoria WHERE resultado = 'denegado' AND accion = 'venta.crear'");
    expect(despues.rows[0].n).toBe(antes.rows[0].n + 1);
    const sinCsrf = await request.post("/api/ventas", { headers: { cookie: cabecera, "content-type": "application/json" }, data: {} });
    expect(sinCsrf.status()).toBe(403);
    await bd.end();
  });

  test("cookie de sesión httpOnly y sin acceso desde JavaScript", async ({ page }) => {
    await entrar(page, "admin@demo.local");
    const cookie = (await page.context().cookies()).find((c) => c.name.includes("sesion"));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("sesion");
  });
});

test.describe("QA-08 · captura de cosechas sin conexión", () => {
  test("la cosecha queda pendiente sin red y se confirma sola al volver la conexión", async ({ page, context }) => {
    await entrar(page, "produccion@demo.local");
    await page.goto("/cosechas/nueva");
    await page.getByLabel("Lote de origen").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Cantidad", { exact: true }).fill("7");
    await page.getByRole("button", { name: "Continuar" }).click();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Guardar cosecha" }).click();
    await expect(page.getByText("Cosecha guardada en este dispositivo.")).toBeVisible();
    await expect(page.locator('[data-estado="pendiente"]').first()).toBeVisible();
    await expect(page.getByTestId("indicador-sync")).toContainText("Sin conexión");
    await context.setOffline(false);
    await expect(page.locator('[data-estado="sincronizada"]').first()).toBeVisible({ timeout: 30_000 });
  });
});
