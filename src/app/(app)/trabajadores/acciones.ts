"use server";

import { revalidatePath } from "next/cache";
import {
  crearTrabajador,
  crearVinculacion,
  liquidarPeriodo,
  anonimizarTrabajador,
  rectificarTrabajador,
  registrarAnticipo,
  registrarJornada,
  listarFincasYLotes,
  registrarPagoTrabajador,
  registrarTrabajo,
  servicios,
  validarTrabajo,
} from "@/composicion";
import { aEstadoError, type EstadoFormulario } from "../../_servidor/errores";
import { exigirContexto } from "../../_servidor/sesion";

const t = (d: FormData, k: string) => String(d.get(k) ?? "");
const dec = (d: FormData, k: string) => t(d, k).replace(",", ".");

async function ejecutar(rutas: string[], mensaje: string, fn: () => Promise<unknown>): Promise<EstadoFormulario> {
  try {
    await fn();
    for (const r of rutas) revalidatePath(r);
    return { ok: true, mensaje };
  } catch (error) {
    return aEstadoError(error);
  }
}

export async function accionCrearTrabajador(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/trabajadores"], "Trabajador creado.", () =>
    crearTrabajador(servicios().talento, ctx, {
      tipoDocumento: t(d, "tipoDocumento"),
      numeroDocumento: t(d, "numeroDocumento"),
      nombres: t(d, "nombres"),
      apellidos: t(d, "apellidos"),
      telefono: t(d, "telefono"),
      fincaId: t(d, "fincaId"),
      modalidad: t(d, "modalidad"),
      autorizaTratamiento: d.get("autorizaTratamiento") === "on",
    }),
  );
}

export async function accionVincular(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/trabajadores"], "Vinculación creada.", () =>
    crearVinculacion(servicios().talento, ctx, {
      trabajadorId: t(d, "trabajadorId"),
      fincaId: t(d, "fincaId"),
      modalidad: t(d, "modalidad"),
      cargo: t(d, "cargo"),
      desde: t(d, "desde"),
      hasta: t(d, "hasta"),
    }),
  );
}

export async function accionAnticipo(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/trabajadores", "/liquidaciones"], "Anticipo registrado.", () =>
    registrarAnticipo(servicios().talento, ctx, {
      trabajadorId: t(d, "trabajadorId"),
      monto: dec(d, "monto"),
      fecha: t(d, "fecha"),
      nota: t(d, "nota"),
      claveIdempotencia: t(d, "claveIdempotencia") || undefined,
    }),
  );
}

export async function accionRegistrarTrabajo(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/trabajo", "/trabajadores"], "Registro guardado. Queda pendiente de validación.", () =>
    registrarTrabajo(servicios().talento, ctx, {
      trabajadorId: t(d, "trabajadorId"),
      fincaId: t(d, "fincaId"),
      loteId: t(d, "loteId"),
      fecha: t(d, "fecha"),
      cantidad: dec(d, "cantidad"),
      unidad: t(d, "unidad"),
      actividad: t(d, "actividad"),
      claveIdempotencia: t(d, "claveIdempotencia") || undefined,
    }),
  );
}

export async function accionValidarTrabajo(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  const decision = t(d, "decision");
  return ejecutar(
    ["/trabajo", "/trabajadores"],
    decision === "validar" ? "Registro validado; el valor se calculó con la tarifa vigente." : "Registro rechazado.",
    () =>
      validarTrabajo(servicios().talento, ctx, {
        registroId: t(d, "registroId"),
        decision,
        cantidadValidada: dec(d, "cantidadValidada"),
        motivo: t(d, "motivo"),
      }),
  );
}

export async function accionLiquidar(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/liquidaciones", "/trabajo", "/trabajadores"], "Período liquidado.", () =>
    liquidarPeriodo(servicios().talento, ctx, {
      trabajadorId: t(d, "trabajadorId"),
      desde: t(d, "desde"),
      hasta: t(d, "hasta"),
      descontarAnticipos: d.get("descontarAnticipos") === "on",
      claveIdempotencia: t(d, "claveIdempotencia") || undefined,
    }),
  );
}

export async function accionPagarTrabajador(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/liquidaciones", "/trabajadores"], "Pago registrado.", () =>
    registrarPagoTrabajador(servicios().talento, ctx, {
      liquidacionId: t(d, "liquidacionId"),
      monto: dec(d, "monto"),
      metodo: t(d, "metodo"),
      fecha: t(d, "fecha"),
      claveIdempotencia: t(d, "claveIdempotencia") || undefined,
    }),
  );
}

export async function accionRectificarTrabajador(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/trabajadores"], "Datos rectificados.", () =>
    rectificarTrabajador(servicios().derechosTrabajador, ctx, { trabajadorId: t(d, "trabajadorId"), nombres: t(d, "nombres") || undefined, apellidos: t(d, "apellidos") || undefined, telefono: t(d, "telefono") }),
  );
}

export async function accionAnonimizarTrabajador(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  return ejecutar(["/trabajadores"], "Datos personales suprimidos (anonimizados). Las liquidaciones y pagos conservan su valor.", () =>
    anonimizarTrabajador(servicios().derechosTrabajador, ctx, { trabajadorId: t(d, "trabajadorId"), motivo: t(d, "motivo") }),
  );
}

/** Labores del día (abonada, fumigación, limpieza o paleo…): una línea por trabajador con jornadas y valor del jornal. */
export async function accionRegistrarJornada(_p: EstadoFormulario, d: FormData) {
  const ctx = await exigirContexto();
  try {
    const { lotes } = await listarFincasYLotes(servicios().fincasLotes, ctx);
    const lote = lotes.find((l) => l.id === t(d, "loteId"));
    if (!lote) return { error: "Seleccione el lote donde se trabajó" } as EstadoFormulario;
    const lineas = [1, 2, 3, 4, 5, 6]
      .filter((n) => t(d, "trabajadorId" + n) !== "")
      .map((n) => ({ trabajadorId: t(d, "trabajadorId" + n), cantidad: dec(d, "cantidad" + n) || "1", unidad: "jornada", valorUnitario: dec(d, "valor" + n) }));
    return await ejecutar(["/trabajo", "/trabajadores", "/liquidaciones"], "Labor registrada y lista para liquidar.", () =>
      registrarJornada(servicios().talento, ctx, { fincaId: lote.fincaId, loteId: lote.id, fecha: t(d, "fecha"), labor: t(d, "labor"), claveIdempotencia: t(d, "claveIdempotencia"), lineas }),
    );
  } catch (error) {
    return aEstadoError(error);
  }
}
