// Funciones compartidas por los escenarios k6 (QA-10 y QA-11).
import http from "k6/http";
import { check } from "k6";

export const BASE = __ENV.APP_URL || "http://localhost:3000";
const datos = JSON.parse(open("../.herramientas/carga.json"));
const NOMBRE_COOKIE = __ENV.COOKIE || "__Host-sesion"; // en producción la cookie lleva el prefijo __Host-

function uuid() {
  const h = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) s += i === 8 || i === 13 || i === 18 || i === 23 ? "-" : i === 14 ? "4" : h[Math.floor(Math.random() * 16)];
  return s;
}

const PAGINAS_LECTURA = ["/inicio", "/inventario", "/cosechas", "/lotes"];

/** Una iteración de uso mixto: 70 % lecturas de páginas autenticadas y 30 % escrituras (cosechas). */
export function iteracion(etapa) {
  const s = datos.sesiones[(__VU - 1) % datos.sesiones.length];
  const cabecera = { Cookie: `${NOMBRE_COOKIE}=${s.cookie}` };
  if (Math.random() < 0.7) {
    const ruta = PAGINAS_LECTURA[Math.floor(Math.random() * PAGINAS_LECTURA.length)];
    const r = http.get(`${BASE}${ruta}`, { headers: cabecera, tags: { tipo: "lectura", etapa } });
    check(r, { "lectura 200": (x) => x.status === 200 });
  } else {
    const i = datos.ids;
    const r = http.post(
      `${BASE}/api/cosechas`,
      JSON.stringify({ fincaId: i.finca, loteId: i.lote, bodegaId: i.bodega, productoId: i.producto, unidadId: i.unidad, fecha: new Date().toISOString().slice(0, 10), cantidad: "5", claveIdempotencia: uuid() }),
      { headers: { ...cabecera, "content-type": "application/json", "x-csrf-token": s.csrf }, tags: { tipo: "escritura", etapa } },
    );
    check(r, { "escritura 201": (x) => x.status === 201 });
  }
}
