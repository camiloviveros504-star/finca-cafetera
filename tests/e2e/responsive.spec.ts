import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { TAMANOS } from "../../playwright.config";

/** QA-16: ningún desborde horizontal en 5 tamaños × flujos clave, con capturas como evidencia. */
const RUTAS = [
  { nombre: "home", ruta: "/", rol: null },
  { nombre: "login", ruta: "/login", rol: null },
  { nombre: "inventario", ruta: "/inventario", rol: "comercial@demo.local" },
  { nombre: "ventas", ruta: "/ventas", rol: "comercial@demo.local" },
  { nombre: "nueva-venta", ruta: "/ventas/nueva", rol: "comercial@demo.local" },
  { nombre: "nueva-cosecha", ruta: "/cosechas/nueva", rol: "produccion@demo.local" },
];

async function entrar(page: Page, correo: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill("Demo-2026!");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL("**/inicio");
}

mkdirSync("docs/pruebas/capturas", { recursive: true });

for (const t of TAMANOS) {
  test.describe(`tamaño ${t.nombre} (${t.ancho}×${t.alto})`, () => {
    test.use({ viewport: { width: t.ancho, height: t.alto } });
    for (const r of RUTAS) {
      test(`${r.nombre} sin scroll horizontal`, async ({ page }) => {
        if (r.rol) await entrar(page, r.rol);
        await page.goto(r.ruta);
        await page.waitForLoadState("networkidle");
        const { ancho, visible } = await page.evaluate(() => ({
          ancho: document.documentElement.scrollWidth,
          visible: window.innerWidth,
        }));
        expect(ancho, `scrollWidth ${ancho} > innerWidth ${visible}`).toBeLessThanOrEqual(visible);
        await page.screenshot({ path: `docs/pruebas/capturas/${r.nombre}-${t.nombre}.png` });
      });
    }
  });
}
