import { NextResponse } from "next/server";
import { registrarCosecha, servicios } from "@/composicion";
import { exigirMutacionSegura, respuestaDeError } from "../_comun";

/** Recibe cosechas de la cola sin conexión. Idempotente por UUID del cliente. */
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
    const r = await registrarCosecha(servicios().produccion, ctx, cuerpo);
    return NextResponse.json(r, { status: r.repetida ? 200 : 201 });
  } catch (error) {
    return respuestaDeError(error, "/api/cosechas");
  }
}
