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

  test("administrador de la plataforma: crea la cuenta de un propietario, no crea fincas y su menú no trae lo operativo", async ({ page }) => {
    await entrar(page, "admin@demo.local");
    const menu = page.getByRole("navigation", { name: "Principal" }).first();
    await expect(menu.getByRole("link", { name: "Fincas", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Mis fincas" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Compra de insumos" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Insumos" })).toHaveCount(0);
    await page.goto("/usuarios");
    const dueno = `Dueño ${Date.now()}`;
    const nueva = page.locator("section", { hasText: "Nueva cuenta" });
    await expect(nueva.locator('[name="fincaIds"]')).toHaveCount(0);
    await nueva.locator('input[name="nombre"]').fill(dueno);
    await nueva.locator('input[name="correo"]').fill(`dueno.${Date.now()}@e2e.test`);
    await nueva.locator('select[name="roles"]').selectOption("propietario");
    await nueva.getByRole("button", { name: "Crear y generar enlace" }).click();
    await expect(nueva.locator('input[aria-label="Enlace de activación"]')).toBeVisible({ timeout: 15000 });
    // En Fincas aparece el propietario, todavía sin fincas, y no hay formulario para crearlas.
    await page.goto("/fincas");
    await expect(page.locator("section", { hasText: dueno }).first()).toContainText("Cuando active su cuenta podrá registrar sus fincas");
    await expect(page.getByRole("button", { name: "Crear finca" })).toHaveCount(0);
  });

  test("activar una cuenta en el mismo navegador del administrador entra con la cuenta nueva, no con la del administrador", async ({ page }) => {
    await entrar(page, "admin@demo.local");
    await page.goto("/usuarios");
    const correo = `activa.${Date.now()}@e2e.test`;
    const nueva = page.locator("section", { hasText: "Nueva cuenta" });
    await nueva.locator('input[name="nombre"]').fill("Propietaria Recién Creada");
    await nueva.locator('input[name="correo"]').fill(correo);
    await nueva.locator('select[name="roles"]').selectOption("propietario");
    await nueva.getByRole("button", { name: "Crear y generar enlace" }).click();
    const enlace = await nueva.locator('input[aria-label="Enlace de activación"]').inputValue({ timeout: 15000 });

    // Se abre el enlace sin cerrar la sesión del administrador.
    await page.goto(new URL(enlace).pathname);
    const clave = "Cosecha-Nueva-2026";
    await page.locator('input[name="contrasena"]').fill(clave);
    await page.locator('input[name="confirmacion"]').fill(clave);
    await page.locator('input[name="acepta"]').check();
    await page.getByRole("button", { name: /Activar|Guardar|Crear/ }).click();
    await page.waitForURL("**/login**");

    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña", { exact: true }).fill(clave);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL("**/inicio");
    const menu = page.getByRole("navigation", { name: "Principal" }).first();
    await expect(menu.getByRole("link", { name: "Mis fincas" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Auditoría" })).toHaveCount(0);
  });

  test("propietario: registra una finca suya en Mis fincas y el administrador la ve a su nombre", async ({ browser }) => {
    const dueno = await (await browser.newContext()).newPage();
    await entrar(dueno, "propietario@demo.local");
    const menu = dueno.getByRole("navigation", { name: "Principal" }).first();
    await expect(menu.getByRole("link", { name: "Compra de insumos" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Fincas", exact: true })).toHaveCount(0);
    await dueno.goto("/fincas");
    await expect(dueno.locator("main [role=alert]")).toContainText("administrador de la plataforma");

    await dueno.goto("/mis-fincas");
    const nombre = `Finca E2E ${Date.now()}`;
    const nueva = dueno.locator("section", { hasText: "Nueva finca" });
    await nueva.locator('input[name="nombre"]').fill(nombre);
    await nueva.locator('input[name="ubicacion"]').fill("Vereda La Prueba");
    await nueva.locator('input[name="areaHa"]').fill("7.5");
    await nueva.getByRole("button", { name: "Crear finca" }).click();
    await expect(dueno.getByRole("heading", { name: nombre })).toBeVisible({ timeout: 15000 });

    const admin = await (await browser.newContext()).newPage();
    await entrar(admin, "admin@demo.local");
    await admin.goto("/fincas");
    await expect(admin.locator("section", { hasText: "propietario@demo.local" }).first()).toContainText(nombre);
  });

  test("propietario: crea la cuenta de su capataz; el administrador no ve formularios de capataz ni trabajador", async ({ browser }) => {
    const dueno = await (await browser.newContext()).newPage();
    await entrar(dueno, "propietario@demo.local");
    await dueno.goto("/usuarios");
    const tarjeta = dueno.locator("section", { hasText: "Cuenta de capataz" });
    await tarjeta.locator('input[name="nombre"]').fill("Capataz de Prueba");
    await tarjeta.locator('input[name="correo"]').fill(`capataz.${Date.now()}@e2e.test`);
    // Si tiene varias fincas, elige cuáles manejará.
    const fincas = tarjeta.getByRole("group", { name: "Fincas que manejará" });
    if (await fincas.count()) await fincas.getByRole("checkbox", { name: "Finca El Mirador DEMO" }).check();
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
