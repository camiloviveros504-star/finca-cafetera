import "server-only";
import { headers } from "next/headers";

/** URL pública de la aplicación: APP_URL si está definida; si no, la del propio pedido (host y protocolo reenviados). */
export async function origenPublico(): Promise<string> {
  const fija = process.env.APP_URL;
  if (fija) return fija.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

export async function urlDeActivacion(token: string): Promise<string> {
  return `${await origenPublico()}/activar/${token}`;
}

export const formatoVencimiento = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(d);
