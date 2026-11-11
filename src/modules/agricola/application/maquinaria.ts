/**
 * Maquinaria y herramientas (extensión 6): equipos, historial de uso (horas y combustible) y mantenimientos con costo.
 * El costo de un mantenimiento se refleja como gasto financiero a través de la capa de aplicación de finanzas.
 */
import { z } from "zod";
import { registrarGasto } from "@/modules/finanzas/application/finanzas";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { mayorQue } from "@/shared/dominio/dinero";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { auditar, clave, fecha, montoTxt, uuid, validar, vacio, type DependenciasAgricola } from "./comun";

const esquemaEquipo = z.object({
  fincaId: uuid,
  tipo: z.enum(["maquinaria", "herramienta", "vehiculo"], { message: "Tipo de equipo inválido" }),
  codigo: z.string().trim().min(2, "Indique el código").max(30),
  nombre: z.string().trim().min(3, "Indique el nombre").max(100),
  intervaloDias: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().min(1).max(3650).optional()),
});

export async function crearEquipo(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaEquipo, cruda, "Revise los datos del equipo");
  await autorizar(deps.auditor, ctx, "equipo:administrar", { accion: "equipo.crear", entidad: "equipo", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearEquipo(tx, { organizacionId: ctx.organizacionId, ...e });
    await auditar(deps, ctx, tx, "equipo.crear", "equipo", id, { codigo: e.codigo });
    return { id };
  });
}

const esquemaUso = z.object({
  equipoId: uuid,
  fecha,
  horas: z.string().regex(/^\d{1,4}(\.\d{1,2})?$/, "Horas inválidas"),
  combustible: z.preprocess(vacio, z.string().regex(/^\d{1,4}(\.\d{1,2})?$/, "Litros inválidos").optional()),
  nota: z.preprocess(vacio, z.string().trim().max(200).optional()),
  claveIdempotencia: clave,
});

export async function registrarUsoEquipo(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaUso, cruda, "Revise los datos del uso");
  if (Number(e.horas) <= 0) throw new ErrorValidacion("Las horas deben ser mayores que cero", { horas: "Inválidas" });
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha no puede ser futura", { fecha: "Fecha futura" });
  await autorizar(deps.auditor, ctx, "equipo:registrar_uso", { accion: "equipo.uso", entidad: "uso_equipo" });
  return deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.buscarUsoPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previo) return { id: previo, repetido: true };
    const eq = await deps.repo.obtenerEquipo(tx, ctx.organizacionId, e.equipoId);
    if (!eq || !ctx.fincaIds.includes(eq.fincaId)) throw new ErrorNoEncontrado("Equipo");
    if (eq.estado !== "activo") throw new ErrorRegla(`El equipo está ${eq.estado.replace("_", " ")} y no puede usarse`, "equipo_no_disponible");
    const id = await deps.repo.insertarUso(tx, { organizacionId: ctx.organizacionId, equipoId: e.equipoId, fecha: e.fecha, horas: e.horas, combustible: e.combustible, nota: e.nota, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId });
    await auditar(deps, ctx, tx, "equipo.uso", "uso_equipo", id, { horas: e.horas });
    return { id, repetido: false };
  });
}

const esquemaMantenimiento = z.object({
  equipoId: uuid,
  fecha,
  tipo: z.enum(["preventivo", "correctivo", "calibracion"], { message: "Tipo de mantenimiento inválido" }),
  descripcion: z.string().trim().min(5, "Describa el trabajo realizado").max(300),
  costo: montoTxt,
  proximoEn: z.preprocess(vacio, fecha.optional()),
  claveIdempotencia: clave,
});

export async function registrarMantenimiento(deps: DependenciasAgricola, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaMantenimiento, cruda, "Revise los datos del mantenimiento");
  await autorizar(deps.auditor, ctx, "equipo:administrar", { accion: "mantenimiento.registrar", entidad: "mantenimiento" });
  const resultado = await deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.buscarMantenimientoPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previo) return { id: previo, repetido: true, fincaId: "" , nombre: "" };
    const eq = await deps.repo.obtenerEquipo(tx, ctx.organizacionId, e.equipoId);
    if (!eq || !ctx.fincaIds.includes(eq.fincaId)) throw new ErrorNoEncontrado("Equipo");
    const id = await deps.repo.insertarMantenimiento(tx, { organizacionId: ctx.organizacionId, equipoId: e.equipoId, fecha: e.fecha, tipo: e.tipo, descripcion: e.descripcion, costo: e.costo, proximoEn: e.proximoEn, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId });
    await auditar(deps, ctx, tx, "mantenimiento.registrar", "mantenimiento", id, { tipo: e.tipo, costo: e.costo });
    return { id, repetido: false, fincaId: eq.fincaId, nombre: eq.nombre };
  });
  // El costo pasa a finanzas como gasto (idempotente por clave derivada). Si el usuario no puede registrar gastos, solo queda el costo.
  let gastoRegistrado = false;
  if (!resultado.repetido && mayorQue(e.costo, "0.00") && ctx.permisos.has("gasto:registrar")) {
    try {
      const g = await registrarGasto(deps.finanzas, ctx, { fincaId: resultado.fincaId, tipo: "mantenimiento", clasificacion: "agricola", fecha: e.fecha, descripcion: `Mantenimiento ${e.tipo}: ${resultado.nombre}`, monto: e.costo, claveIdempotencia: `mant:${e.claveIdempotencia}` });
      await deps.uow.ejecutar((tx) => deps.repo.vincularGasto(tx, resultado.id, g.id));
      gastoRegistrado = true;
    } catch {
      gastoRegistrado = false; // el mantenimiento queda registrado; el gasto se puede cargar manualmente
    }
  }
  return { id: resultado.id, repetido: resultado.repetido, gastoRegistrado };
}

export async function listarEquipos(deps: DependenciasAgricola, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "equipo:ver", { accion: "equipo.listar", entidad: "equipo" });
  return deps.uow.consultar(async (tx) => ({
    equipos: await deps.repo.listarEquipos(tx, ctx.organizacionId, ctx.fincaIds, fechaColombia()),
    mantenimientos: await deps.repo.listarMantenimientos(tx, ctx.organizacionId, ctx.fincaIds),
  }));
}
