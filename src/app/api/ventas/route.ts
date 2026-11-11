import { NextResponse } from "next/server";
import { registrarVenta, servicios } from "@/composicion";
import { exigirMutacionSegura, respuestaDeError } from "../_comun";

/** API de ventas (QA-05): misma autorización que la interfaz; las ventas nunca se confirman sin el servidor. */
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
    const r = await registrarVenta(servicios().comercial, ctx, cuerpo);
    return NextResponse.json(r, { status: r.repetida ? 200 : 201 });
  } catch (error) {
    return respuestaDeError(error, "/api/ventas");
  }
}
