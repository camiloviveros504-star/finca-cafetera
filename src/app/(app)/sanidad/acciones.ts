"use server";

import { revalidatePath } from "next/cache";
import {
  cerrarActividad, crearAgroquimico, crearEquipo, programarActividad, registrarAmbiental, registrarAplicacion, registrarEntradaAgroquimico, registrarInspeccion,
  registrarMantenimiento, registrarProyeccion, registrarUsoEquipo, servicios,
} from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "");
const dec = (d: FormData, k: string) => t(d, k).replace(",", ".");

async function ejecutar(rutas: string[], mensaje: string | ((r: unknown) => string), fn: () => Promise<unknown>): Promise<EstadoFormulario> {
  try {
    const r = await fn();
    for (const ruta of rutas) revalidatePath(ruta);
    return { ok: true, mensaje: typeof mensaje === "function" ? mensaje(r) : mensaje };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionInspeccion(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/sanidad"], "Inspección registrada.", () =>
    registrarInspeccion(servicios().agricola, ctx, { fincaId: t(d, "fincaId"), loteId: t(d, "loteId"), fecha: t(d, "fecha"), tipo: t(d, "tipo"), severidad: t(d, "severidad"), infestacionPct: dec(d, "infestacionPct"), hallazgos: t(d, "hallazgos"), acciones: t(d, "acciones"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionAmbiental(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/sanidad"], "Registro ambiental guardado.", () =>
    registrarAmbiental(servicios().agricola, ctx, { fincaId: t(d, "fincaId"), fecha: t(d, "fecha"), tipo: t(d, "tipo"), descripcion: t(d, "descripcion"), cantidad: dec(d, "cantidad"), unidad: t(d, "unidad"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionCrearAgroquimico(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/sanidad"], "Insumo creado.", () => crearAgroquimico(servicios().agricola, ctx, { nombre: t(d, "nombre"), unidad: t(d, "unidad"), tipo: t(d, "tipo") || "fertilizante", gramosPorUnidad: dec(d, "gramosPorUnidad"), fincaId: t(d, "fincaId"), carenciaDias: t(d, "carenciaDias") }));
}

export async function accionEntradaAgroquimico(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/sanidad"], "Entrada registrada.", () =>
    registrarEntradaAgroquimico(servicios().agricola, ctx, { fincaId: t(d, "fincaId"), agroquimicoId: t(d, "agroquimicoId"), loteComercial: t(d, "loteComercial"), vencimiento: t(d, "vencimiento"), cantidad: dec(d, "cantidad"), nota: t(d, "nota") }),
  );
}

export async function accionAplicacion(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/sanidad"], (r) => `Aplicación registrada${(r as { cantidadTotal?: string }).cantidadTotal ? `: se descontaron ${(r as { cantidadTotal: string }).cantidadTotal} del inventario` : ""}${(r as { fechaReingreso?: string | null }).fechaReingreso ? `. Reingreso/cosecha segura desde ${(r as { fechaReingreso: string }).fechaReingreso}` : ""}.`, () =>
    registrarAplicacion(servicios().agricola, ctx, { stockId: t(d, "stockId"), loteId: t(d, "loteId"), fecha: t(d, "fecha"), cantidadTotal: dec(d, "cantidadTotal"), gramosPorArbol: dec(d, "gramosPorArbol"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionProgramarActividad(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/planificacion"], "Actividad programada.", () =>
    programarActividad(servicios().agricola, ctx, { fincaId: t(d, "fincaId"), loteId: t(d, "loteId"), tipo: t(d, "tipo"), titulo: t(d, "titulo"), fecha: t(d, "fecha"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionCerrarActividad(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/planificacion"], "Actividad cerrada.", () => cerrarActividad(servicios().agricola, ctx, { actividadId: t(d, "actividadId"), estado: t(d, "estado"), resultado: t(d, "resultado") }));
}

export async function accionProyeccion(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/planificacion"], "Proyección registrada.", () =>
    registrarProyeccion(servicios().agricola, ctx, { fincaId: t(d, "fincaId"), loteId: t(d, "loteId"), desde: t(d, "desde"), hasta: t(d, "hasta"), estimadoKg: dec(d, "estimadoKg"), nota: t(d, "nota"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionCrearEquipo(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/maquinaria"], "Equipo creado.", () => crearEquipo(servicios().agricola, ctx, { fincaId: t(d, "fincaId"), tipo: t(d, "tipo"), codigo: t(d, "codigo"), nombre: t(d, "nombre"), intervaloDias: t(d, "intervaloDias") }));
}

export async function accionUsoEquipo(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/maquinaria"], "Uso registrado.", () =>
    registrarUsoEquipo(servicios().agricola, ctx, { equipoId: t(d, "equipoId"), fecha: t(d, "fecha"), horas: dec(d, "horas"), combustible: dec(d, "combustible"), nota: t(d, "nota"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}

export async function accionMantenimiento(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/maquinaria", "/finanzas"], (r) => ((r as { gastoRegistrado?: boolean }).gastoRegistrado ? "Mantenimiento registrado y cargado como gasto." : "Mantenimiento registrado (sin gasto asociado)."), () =>
    registrarMantenimiento(servicios().agricola, ctx, { equipoId: t(d, "equipoId"), fecha: t(d, "fecha"), tipo: t(d, "tipo"), descripcion: t(d, "descripcion"), costo: dec(d, "costo") || "0", proximoEn: t(d, "proximoEn"), claveIdempotencia: t(d, "claveIdempotencia") }),
  );
}
