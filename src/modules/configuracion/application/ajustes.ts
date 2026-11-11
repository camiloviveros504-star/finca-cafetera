/**
 * Configuración general (prompt §6): catálogos (métodos de pago, tipos de gasto, tipos de café, categorías, estados),
 * unidades y equivalencias con vigencia, temporadas y parámetros operativos. Ningún valor está en el código: el
 * administrador los configura y cada cambio queda en la auditoría. Las reglas de integridad no son configurables.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { CATALOGOS, PARAMETROS, type ClaveParametro, type RepositorioAjustes } from "../domain/ajustes";

export interface DependenciasAjustes {
  repo: RepositorioAjustes;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

function validar<T extends z.ZodTypeAny>(esquema: T, entrada: unknown, mensaje: string): z.infer<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
  throw new ErrorValidacion(mensaje, campos);
}
const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const auditar = (deps: DependenciasAjustes, ctx: ContextoUsuario, tx: Parameters<Auditor["registrar"]>[1], accion: string, entidad: string, entidadId: string, antes: unknown, despues: unknown) =>
  deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion, entidad, entidadId, resultado: "ok", antes, despues, ip: ctx.ip }, tx);

export async function obtenerAjustes(deps: DependenciasAjustes, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "configuracion:ver", { accion: "configuracion.ver", entidad: "configuracion" });
  return deps.uow.consultar(async (tx) => ({
    catalogos: await deps.repo.listarCatalogos(tx, ctx.organizacionId),
    equivalencias: await deps.repo.listarEquivalencias(tx, ctx.organizacionId, fechaColombia()),
    temporadas: await deps.repo.listarTemporadas(tx, ctx.organizacionId),
    parametros: await deps.repo.listarParametros(tx, ctx.organizacionId, ctx.fincaIds),
    definiciones: Object.entries(PARAMETROS).map(([clave, d]) => ({ clave, descripcion: d.descripcion, min: d.min, max: d.max })),
  }));
}

// ───────────── Catálogos ─────────────

const esquemaValor = z.object({
  catalogo: z.enum(CATALOGOS, { message: "Catálogo inválido" }),
  codigo: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "Use minúsculas, números o guion bajo (2 a 40)"),
  nombre: z.string().trim().min(2, "Indique el nombre").max(80),
});

export async function crearValorCatalogo(deps: DependenciasAjustes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaValor, cruda, "Revise los datos del valor");
  await autorizar(deps.auditor, ctx, "configuracion:modificar", { accion: "catalogo.crear", entidad: "catalogo_valor" });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearValorCatalogo(tx, { organizacionId: ctx.organizacionId, ...e });
    await auditar(deps, ctx, tx, "catalogo.crear", "catalogo_valor", id, null, e);
    return { id };
  });
}

export async function cambiarEstadoValorCatalogo(deps: DependenciasAjustes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ id: z.string().uuid(), activo: z.boolean() }), cruda, "Revise los datos");
  await autorizar(deps.auditor, ctx, "configuracion:modificar", { accion: "catalogo.estado", entidad: "catalogo_valor" });
  return deps.uow.ejecutar(async (tx) => {
    if (!(await deps.repo.cambiarEstadoValor(tx, ctx.organizacionId, e.id, e.activo))) throw new ErrorNoEncontrado("Valor de catálogo");
    await auditar(deps, ctx, tx, "catalogo.estado", "catalogo_valor", e.id, { activo: !e.activo }, { activo: e.activo });
    return { ok: true };
  });
}

// ───────────── Equivalencias de unidades (con vigencia, sin solapamiento) ─────────────

const esquemaEquivalencia = z.object({
  fincaId: z.preprocess(vacio, z.string().uuid().optional()),
  origen: z.string().trim().min(1),
  destino: z.string().trim().min(1),
  factor: z.string().regex(/^\d{1,10}(\.\d{1,6})?$/, "Factor inválido (máximo 6 decimales)"),
  desde: fecha,
});

/**
 * Una nueva equivalencia cierra la anterior del mismo ámbito en su fecha de inicio. No se reescribe el pasado:
 * las cosechas y liquidaciones ya hechas guardan el factor que se aplicó.
 */
export async function crearEquivalencia(deps: DependenciasAjustes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaEquivalencia, cruda, "Revise los datos de la equivalencia");
  if (Number(e.factor) <= 0) throw new ErrorValidacion("El factor debe ser mayor que cero", { factor: "Factor inválido" });
  if (e.origen === e.destino) throw new ErrorValidacion("Las unidades deben ser distintas", { destino: "Igual al origen" });
  await autorizar(deps.auditor, ctx, "configuracion:modificar", { accion: "equivalencia.crear", entidad: "conversion_unidad", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const o = await deps.repo.unidadId(tx, e.origen);
    const d = await deps.repo.unidadId(tx, e.destino);
    if (!o || !d) throw new ErrorRegla("Unidad desconocida", "unidad_invalida");
    if (o.tipo !== d.tipo) throw new ErrorRegla("Solo se convierten unidades del mismo tipo", "unidades_incompatibles");
    const ultima = await deps.repo.ultimaEquivalencia(tx, ctx.organizacionId, e.fincaId ?? null, o.id, d.id);
    if (ultima) {
      if (e.desde < fechaColombia()) throw new ErrorRegla("La vigencia no puede empezar en el pasado: no se reescribe el historial", "vigencia_pasada");
      if (ultima.hasta === null) {
        if (e.desde <= ultima.desde) throw new ErrorRegla("La nueva vigencia debe empezar después de la anterior", "vigencia_solapada");
        await deps.repo.cerrarEquivalencia(tx, ultima.id, e.desde);
      } else if (e.desde < ultima.hasta) {
        throw new ErrorRegla("La nueva vigencia se solapa con la anterior", "vigencia_solapada");
      }
    }
    const id = await deps.repo.insertarEquivalencia(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId ?? null, origenId: o.id, destinoId: d.id, factor: e.factor, desde: e.desde, creadaPor: ctx.usuarioId });
    await auditar(deps, ctx, tx, "equivalencia.crear", "conversion_unidad", id, ultima ? { cerrada: ultima.id } : null, { origen: e.origen, destino: e.destino, factor: e.factor, desde: e.desde });
    return { id };
  });
}

// ───────────── Temporadas ─────────────

export async function crearTemporada(deps: DependenciasAjustes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ nombre: z.string().trim().min(3, "Indique el nombre").max(80), desde: fecha, hasta: fecha }), cruda, "Revise los datos de la temporada");
  if (e.hasta < e.desde) throw new ErrorValidacion("El período es inválido", { hasta: "Debe ser posterior al inicio" });
  await autorizar(deps.auditor, ctx, "configuracion:modificar", { accion: "temporada.crear", entidad: "temporada" });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.insertarTemporada(tx, { organizacionId: ctx.organizacionId, ...e });
    await auditar(deps, ctx, tx, "temporada.crear", "temporada", id, null, e);
    return { id };
  });
}

// ───────────── Parámetros operativos ─────────────

export async function guardarParametro(deps: DependenciasAjustes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ clave: z.string(), valor: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Valor inválido"), fincaId: z.preprocess(vacio, z.string().uuid().optional()) }), cruda, "Revise los datos del parámetro");
  const def = PARAMETROS[e.clave as ClaveParametro];
  if (!def) throw new ErrorValidacion("Parámetro desconocido", { clave: "No configurable" });
  if (Number(e.valor) < def.min || Number(e.valor) > def.max) throw new ErrorValidacion(`El valor debe estar entre ${def.min} y ${def.max}`, { valor: "Fuera de rango" });
  await autorizar(deps.auditor, ctx, "configuracion:modificar", { accion: "parametro.guardar", entidad: "parametro", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const r = await deps.repo.guardarParametro(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId ?? null, clave: e.clave, valor: e.valor, usuarioId: ctx.usuarioId });
    await auditar(deps, ctx, tx, "parametro.guardar", "parametro", e.clave, { valor: r.anterior }, { valor: e.valor, fincaId: e.fincaId ?? null });
    return { ok: true };
  });
}

/** Lectura de un parámetro con prioridad: el de la finca, luego el general de la organización. */
export async function leerParametroNumerico(deps: { repo: RepositorioAjustes }, tx: Parameters<RepositorioAjustes["obtenerParametro"]>[0], organizacionId: string, fincaId: string, clave: ClaveParametro): Promise<number | null> {
  const v = await deps.repo.obtenerParametro(tx, organizacionId, fincaId, clave);
  return v === null ? null : Number(v);
}

export type { Equivalencia, ParametroConfigurado, Temporada, ValorCatalogo } from "../domain/ajustes";
