import { defineConfig } from "@playwright/test";

/** Los 5 tamaños de referencia de la sección 15.4 del prompt maestro. */
export const TAMANOS = [
  { nombre: "movil-360", ancho: 360, alto: 640 },
  { nombre: "movil-390", ancho: 390, alto: 844 },
  { nombre: "tablet-768", ancho: 768, alto: 1024 },
  { nombre: "portatil-1366", ancho: 1366, alto: 768 },
  { nombre: "escritorio-1920", ancho: 1920, alto: 1080 },
];

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    channel: process.env.PW_CHANNEL ?? "chrome",
    trace: "off",
  },
});
