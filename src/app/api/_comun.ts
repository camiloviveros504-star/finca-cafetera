import { NextResponse } from "next/server";
import { ErrorNegocio, ErrorValidacion, type ContextoUsuario } from "@/composicion";
import { contextoActual } from "../_servidor/sesion";

/**
 * Verificaciones comunes de toda mutación expuesta como Route Handler:
 * sesión válida, Origin igual al host y token CSRF de la sesión.
 */
export async function exigirMutacionSegura(solicitud: Request): Promise<ContextoUsuario | NextResponse> {
  const ctx = await contextoActual();
  if (!ctx) return NextResponse.json({ error: "Debe iniciar sesión para continuar" }, { status: 401 });
  const origen = solicitud.headers.get("origin");
  const host = solicitud.headers.get("host");
  if (origen && host && new URL(origen).host !== host) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  if (solicitud.headers.get("x-csrf-token") !== ctx.csrfToken) {
    return NextResponse.json({ error: "Token CSRF inválido" }, { status: 403 });
  }
  return ctx;
}

export function respuestaDeError(error: unknown, ruta: string): NextResponse {
  if (error instanceof ErrorValidacion) return NextResponse.json({ error: error.message, campos: error.campos }, { status: 400 });
  if (error instanceof ErrorNegocio) return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: error.estadoHttp });
  console.error(`Error no controlado en ${ruta}`);
  return NextResponse.json({ error: "Ocurrió un error inesperado" }, { status: 500 });
}
