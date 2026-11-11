import { NextResponse } from "next/server";
import { registrarTrabajo, servicios } from "@/composicion";
import { exigirMutacionSegura, respuestaDeError } from "../_comun";

/** Recibe producción de trabajadores de la cola sin conexión. Idempotente por UUID del cliente. */
export async function POST(solicitud: Request) {
  const ctx = await exigirMutacionSegura(solicitud);
  if (ctx instanceof NextResponse) return ctx;
  let cuerpo: unknown;
  try {
    cuerpo = await solicitud.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }
  try {
    const r = await registrarTrabajo(servicios().talento, ctx, cuerpo);
    const repetido = "repetido" in r ? r.repetido : (r as { repetida?: boolean }).repetida;
    return NextResponse.json(r, { status: repetido ? 200 : 201 });
  } catch (error) {
    return respuestaDeError(error, "/api/trabajo");
  }
}
