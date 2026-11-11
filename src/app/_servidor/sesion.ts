import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ErrorNoAutenticado, obtenerContexto, servicios, type ContextoUsuario } from "@/composicion";

export const NOMBRE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-sesion" : "sesion";

export async function ipDeSolicitud(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
}

/** Contexto del usuario autenticado, o null. No lanza. */
export async function contextoActual(): Promise<ContextoUsuario | null> {
  const token = (await cookies()).get(NOMBRE_COOKIE)?.value;
  if (!token) return null;
  try {
    return await obtenerContexto(servicios().sesion, token, await ipDeSolicitud());
  } catch (error) {
    if (error instanceof ErrorNoAutenticado) return null;
    throw error;
  }
}

/** Para páginas protegidas: sin sesión redirige al login. La autorización fina la hace cada caso de uso. */
export async function exigirContexto(): Promise<ContextoUsuario> {
  const ctx = await contextoActual();
  if (!ctx) redirect("/login");
  return ctx;
}
