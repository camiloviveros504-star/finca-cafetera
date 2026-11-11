/**
 * Sanidad e inspecciones (extensión 4): inspecciones (broca, roya, plagas), inventario de agroquímicos con vencimiento,
 * aplicaciones con dosis y responsable, y registros ambientales. Las existencias de agroquímicos nunca quedan negativas
 * y no se aplica producto vencido. Los períodos de carencia son datos del producto, no constantes del código.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, deEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { auditar, cantidadTxt, clave, fecha, sumarDias, uuid, validar, vacio, type DependenciasAgricola } from "./comun";

const esquemaInspeccion = z.object({
  fincaId: uuid,
  loteId: z.preprocess(vacio, uuid.optional()),
  fecha,
  tipo: z.enum(["broca", "roya", "plaga", "enfermedad", "general"], { message: "Tipo de inspección inválido" }),
  severidad: z.enum(["ninguna", "baja", "media", "alta"], { message: "Severidad inválida" }),
  infestacionPct: z.preprocess(vacio, z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Porcentaje inválido").optional()),
  hallazgos: z.string().trim().min(5, "Describa los hallazgos").max(500),
  acciones: z.preprocess(vacio, z.string().trim().max(500).optional()),
  claveIdempotencia: clave,
});

export async function registrarInspeccion(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaInspeccion, cruda, "Revise los datos de la inspección");
  if (e.infestacionPct !== undefined && Number(e.infestacionPct) > 100) throw new ErrorValidacion("El porcentaje no puede superar 100", { infestacionPct: "Inválido" });
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha no puede ser futura", { fecha: "Fecha futura" });
  await autorizar(deps.auditor, ctx, "inspeccion:registrar", { accion: "inspeccion.registrar", entidad: "inspeccion", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const previa = await deps.repo.buscarInspeccionPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previa) return { id: previa, repetida: true };
    if (e.loteId && !(await deps.repo.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, e.fincaId))) throw new ErrorRegla("El lote no pertenece a la finca indicada", "lote_invalido");
    const id = await deps.repo.insertarInspeccion(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, loteId: e.loteId, fecha: e.fecha, tipo: e.tipo, severidad: e.severidad, infestacionPct: e.infestacionPct, hallazgos: e.hallazgos, acciones: e.acciones, clave: e.claveIdempotencia, inspectorId: ctx.usuarioId });
    await auditar(deps, ctx, tx, "inspeccion.registrar", "inspeccion", id, { tipo: e.tipo, severidad: e.severidad });
    return { id, repetida: false };
  });
}

export async function listarInspecciones(deps: DependenciasAgricola, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "inspeccion:ver", { accion: "inspeccion.listar", entidad: "inspeccion" });
  return deps.uow.consultar((tx) => deps.repo.listarInspecciones(tx, ctx.organizacionId, ctx.fincaIds));
}

const esquemaAmbiental = z.object({
  fincaId: uuid,
  fecha,
  tipo: z.enum(["envases", "residuos", "agua", "erosion", "otro"], { message: "Tipo de registro inválido" }),
  descripcion: z.string().trim().min(5, "Describa el registro").max(500),
  cantidad: z.preprocess(vacio, cantidadTxt.optional()),
  unidad: z.preprocess(vacio, z.string().trim().max(20).optional()),
  claveIdempotencia: clave,
});

export async function registrarAmbiental(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaAmbiental, cruda, "Revise los datos del registro ambiental");
  await autorizar(deps.auditor, ctx, "inspeccion:registrar", { accion: "ambiental.registrar", entidad: "registro_ambiental", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.buscarAmbientalPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previo) return { id: previo, repetido: true };
    const id = await deps.repo.insertarAmbiental(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, fecha: e.fecha, tipo: e.tipo, descripcion: e.descripcion, cantidad: e.cantidad, unidad: e.unidad, clave: e.claveIdempotencia, responsableId: ctx.usuarioId });
    await auditar(deps, ctx, tx, "ambiental.registrar", "registro_ambiental", id, { tipo: e.tipo });
    return { id, repetido: false };
  });
}

export async function listarAmbientales(deps: DependenciasAgricola, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "inspeccion:ver", { accion: "ambiental.listar", entidad: "registro_ambiental" });
  return deps.uow.consultar((tx) => deps.repo.listarAmbientales(tx, ctx.organizacionId, ctx.fincaIds));
}

// ───────────── Agroquímicos: catálogo, existencias con vencimiento y aplicaciones ─────────────

export async function crearAgroquimico(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(
    z.object({ nombre: z.string().trim().min(3, "Indique el nombre").max(100), unidad: z.string().trim().min(1).max(20), tipo: z.enum(["fertilizante", "fumigante", "herbicida", "herramienta", "otro"], { message: "Tipo de insumo inválido" }).default("fertilizante"), gramosPorUnidad: z.preprocess(vacio, cantidadTxt.optional()), fincaId: z.preprocess(vacio, uuid.optional()), carenciaDias: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(0).max(365).optional()) }),
    cruda,
    "Revise los datos del agroquímico",
  );
  if (e.gramosPorUnidad !== undefined && aEscala(e.gramosPorUnidad, ESCALA_CANTIDAD) <= 0n) throw new ErrorValidacion("Los gramos por unidad deben ser mayores que cero", { gramosPorUnidad: "Inválido" });
  if (e.fincaId && !ctx.fincaIds.includes(e.fincaId)) throw new ErrorNoEncontrado("Finca");
  await autorizar(deps.auditor, ctx, "agroquimico:administrar", { accion: "agroquimico.crear", entidad: "agroquimico", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearAgroquimico(tx, { organizacionId: ctx.organizacionId, ...e });
    await auditar(deps, ctx, tx, "agroquimico.crear", "agroquimico", id, { nombre: e.nombre });
    return { id };
  });
}

const esquemaEntrada = z.object({ fincaId: uuid, agroquimicoId: uuid, loteComercial: z.preprocess((v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? "Sin lote" : v), z.string().trim().min(1).max(60)), vencimiento: z.preprocess(vacio, fecha.optional()), cantidad: cantidadTxt, nota: z.preprocess(vacio, z.string().trim().max(200).optional()) });

export async function registrarEntradaAgroquimico(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaEntrada, cruda, "Revise los datos de la entrada");
  if (aEscala(e.cantidad, ESCALA_CANTIDAD) <= 0n) throw new ErrorValidacion("La cantidad debe ser mayor que cero", { cantidad: "Cantidad inválida" });
  await autorizar(deps.auditor, ctx, "agroquimico:administrar", { accion: "agroquimico.entrada", entidad: "agroquimico_stock", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    if (!(await deps.repo.agroquimicoExiste(tx, ctx.organizacionId, e.agroquimicoId))) throw new ErrorNoEncontrado("Agroquímico");
    const id = await deps.repo.acreditarStock(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, agroquimicoId: e.agroquimicoId, loteComercial: e.loteComercial, vencimiento: e.vencimiento ?? null, cantidad: e.cantidad, usuarioId: ctx.usuarioId, nota: e.nota });
    await auditar(deps, ctx, tx, "agroquimico.entrada", "agroquimico_stock", id, { cantidad: e.cantidad, vencimiento: e.vencimiento });
    return { id };
  });
}

const esquemaAplicacion = z.object({ stockId: uuid, loteId: uuid, fecha, dosis: z.preprocess(vacio, cantidadTxt.optional()), unidadDosis: z.preprocess(vacio, z.string().trim().min(1).max(30).optional()), cantidadTotal: z.preprocess(vacio, cantidadTxt.optional()), gramosPorArbol: z.preprocess(vacio, cantidadTxt.optional()), inspeccionId: z.preprocess(vacio, uuid.optional()), claveIdempotencia: clave });

/** Descuenta del stock con bloqueo de fila: dos aplicaciones simultáneas no pueden dejar el stock en negativo. */
export async function registrarAplicacion(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaAplicacion, cruda, "Revise los datos de la aplicación");
  const porArbol = e.gramosPorArbol !== undefined;
  if (porArbol) {
    if (aEscala(e.gramosPorArbol!, ESCALA_CANTIDAD) <= 0n) throw new ErrorValidacion("Los gramos por árbol deben ser mayores que cero", { gramosPorArbol: "Inválido" });
  } else {
    // Asignar bultos (o litros, kilos…) al lote es lo mínimo; la dosis es opcional y, si se omite, queda igual a la cantidad.
    if (!e.cantidadTotal) throw new ErrorValidacion("Indique cuántos bultos (o unidades) se asignan al lote, o los gramos por árbol", { cantidadTotal: "Obligatorio" });
    if (aEscala(e.cantidadTotal, ESCALA_CANTIDAD) <= 0n || (e.dosis !== undefined && aEscala(e.dosis, ESCALA_CANTIDAD) <= 0n)) throw new ErrorValidacion("La cantidad debe ser mayor que cero", { cantidadTotal: "Inválida" });
  }
  await autorizar(deps.auditor, ctx, "aplicacion:registrar", { accion: "aplicacion.registrar", entidad: "aplicacion_agroquimica" });
  return deps.uow.ejecutar(async (tx) => {
    const previa = await deps.repo.buscarAplicacionPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previa) return { id: previa, repetida: true, fechaReingreso: null as string | null };
    const stock = await deps.repo.bloquearStock(tx, ctx.organizacionId, e.stockId);
    if (!stock || !ctx.fincaIds.includes(stock.fincaId)) throw new ErrorNoEncontrado("Existencia de agroquímico");
    if (!(await deps.repo.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, stock.fincaId))) throw new ErrorRegla("El lote no pertenece a la finca de la existencia", "lote_invalido");
    // Abonada por árbol: cantidad = gramos por árbol × árboles del lote ÷ gramos de cada bulto (redondeo al milésimo).
    let arboles: number | undefined;
    let cantidadTotal = e.cantidadTotal ?? "0";
    let dosis = e.dosis ?? cantidadTotal;
    let unidadDosis = e.unidadDosis ?? stock.unidad;
    if (porArbol) {
      const n = await deps.repo.arbolesDelLote(tx, ctx.organizacionId, e.loteId);
      if (!n) throw new ErrorRegla("El lote no tiene árboles registrados; siembre el lote o indique la cantidad manualmente", "lote_sin_arboles");
      if (!stock.gramosPorUnidad) throw new ErrorRegla("Este insumo no tiene definidos los gramos por unidad (bulto); defínalos o indique la cantidad manualmente", "insumo_sin_gramos");
      const g = aEscala(e.gramosPorArbol!, ESCALA_CANTIDAD);
      const gpu = aEscala(stock.gramosPorUnidad, ESCALA_CANTIDAD);
      const num = g * BigInt(n) * 1000n;
      cantidadTotal = deEscala((num + gpu / 2n) / gpu, ESCALA_CANTIDAD);
      if (aEscala(cantidadTotal, ESCALA_CANTIDAD) <= 0n) throw new ErrorValidacion("La cantidad calculada es cero", { gramosPorArbol: "Muy pequeña" });
      arboles = n;
      dosis = e.gramosPorArbol!;
      unidadDosis = "g por árbol";
    }
    if (stock.vencimiento && stock.vencimiento < e.fecha) throw new ErrorRegla(`El producto está vencido (vencía el ${stock.vencimiento}); no se puede aplicar`, "producto_vencido");
    if (aEscala(stock.cantidad, ESCALA_CANTIDAD) < aEscala(cantidadTotal, ESCALA_CANTIDAD)) throw new ErrorRegla(`Existencias insuficientes: disponibles ${stock.cantidad} ${stock.unidad}`, "existencias_insuficientes");
    const reingreso = stock.carenciaDias !== null ? sumarDias(e.fecha, stock.carenciaDias) : null;
    await deps.repo.descontarStock(tx, stock.id, cantidadTotal);
    const id = await deps.repo.insertarAplicacion(tx, { organizacionId: ctx.organizacionId, fincaId: stock.fincaId, loteId: e.loteId, stockId: stock.id, fecha: e.fecha, dosis, unidadDosis, cantidadTotal, fechaReingreso: reingreso, inspeccionId: e.inspeccionId, responsableId: ctx.usuarioId, clave: e.claveIdempotencia, gramosPorArbol: e.gramosPorArbol, arboles });
    await deps.repo.insertarMovimientoAgroquimico(tx, { organizacionId: ctx.organizacionId, stockId: stock.id, tipo: "aplicacion", delta: `-${cantidadTotal}`, origenId: id, usuarioId: ctx.usuarioId });
    await auditar(deps, ctx, tx, "aplicacion.registrar", "aplicacion_agroquimica", id, { stockId: stock.id, cantidad: cantidadTotal, reingreso });
    return { id, repetida: false, fechaReingreso: reingreso, cantidadTotal };
  });
}

export async function listarAgroquimicos(deps: DependenciasAgricola, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "agroquimico:ver", { accion: "agroquimico.listar", entidad: "agroquimico" });
  return deps.uow.consultar(async (tx) => ({
    catalogo: await deps.repo.listarAgroquimicos(tx, ctx.organizacionId, ctx.fincaIds),
    stock: await deps.repo.listarStock(tx, ctx.organizacionId, ctx.fincaIds, fechaColombia()),
    aplicaciones: await deps.repo.listarAplicaciones(tx, ctx.organizacionId, ctx.fincaIds),
  }));
}
