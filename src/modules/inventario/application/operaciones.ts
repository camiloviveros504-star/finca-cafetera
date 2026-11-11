import { randomUUID } from "node:crypto";
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario, Transaccion } from "@/shared/dominio/contexto";
import { aEscala, deEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import {
  ErrorClaveDuplicada,
  ErrorExistenciasInsuficientes,
  ErrorNegocio,
  ErrorNoEncontrado,
  ErrorRegla,
  ErrorValidacion,
} from "@/shared/dominio/errores";
import type { FilaMovimiento, RepositorioInventario, RepositorioOperacionesInventario } from "../domain/puertos";

export interface DependenciasOperaciones {
  repo: RepositorioInventario;
  ops: RepositorioOperacionesInventario;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const cantidadPositiva = z
  .string()
  .regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida (máximo 3 decimales)")
  .refine((v) => aEscala(v, ESCALA_CANTIDAD) > 0n, "La cantidad debe ser mayor que cero");
const uuid = z.string().uuid();
const motivo = z.string().trim().min(3, "Indique el motivo").max(300);

function validar<T extends z.ZodTypeAny>(esquema: T, entrada: unknown, mensaje: string): z.infer<T> {
  const r = esquema.safeParse(entrada);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
  throw new ErrorValidacion(mensaje, campos);
}

async function auditarError(deps: DependenciasOperaciones, ctx: ContextoUsuario, accion: string, error: unknown) {
  if (error instanceof ErrorNegocio) {
    await deps.auditor.registrar({
      organizacionId: ctx.organizacionId,
      usuarioId: ctx.usuarioId,
      accion,
      entidad: "movimiento_inventario",
      resultado: "error",
      despues: { codigo: error.codigo },
      ip: ctx.ip,
    });
  }
}

/** Resta `cantidad` de un saldo bloqueado; falla si no alcanza (nunca queda negativo). */
async function restar(
  deps: DependenciasOperaciones,
  tx: Transaccion,
  u: { bodegaId: string; productoId: string; loteId: string },
  cantidad: string,
): Promise<void> {
  const saldo = await deps.ops.bloquearSaldoExacto(tx, u);
  const disponible = saldo ? aEscala(saldo.cantidad, ESCALA_CANTIDAD) : 0n;
  if (!saldo || disponible < aEscala(cantidad, ESCALA_CANTIDAD)) {
    throw new ErrorExistenciasInsuficientes(deEscala(disponible, ESCALA_CANTIDAD));
  }
  await deps.repo.descontarSaldo(tx, saldo.id, cantidad);
}

// ───────────── Ajustes y pérdidas ─────────────

const esquemaAjuste = z.object({
  fincaId: uuid,
  bodegaId: uuid,
  productoId: uuid,
  loteId: uuid,
  tipo: z.enum(["ajuste", "perdida"]),
  sentido: z.enum(["aumento", "disminucion"]).optional(),
  cantidad: cantidadPositiva,
  motivo,
  claveIdempotencia: z.string().min(8).max(100),
});

export async function registrarAjuste(deps: DependenciasOperaciones, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaAjuste, cruda, "Revise los datos del ajuste");
  await autorizar(deps.auditor, ctx, "inventario:ajustar", { accion: `inventario.${e.tipo}`, entidad: "movimiento_inventario", fincaId: e.fincaId });
  const resta = e.tipo === "perdida" || e.sentido === "disminucion";
  const clave = `aj:${ctx.organizacionId}:${e.claveIdempotencia}`;
  try {
    return await deps.uow.ejecutar(async (tx) => {
      const previo = await deps.ops.buscarMovimientoPorClave(tx, ctx.organizacionId, clave);
      if (previo) return { movimientoId: previo.id, repetida: true };
      if (!(await deps.ops.ubicacionValida(tx, ctx.organizacionId, e))) throw new ErrorRegla("Bodega, lote o producto no válidos para la finca", "ubicacion_invalida");
      if (resta) await restar(deps, tx, e, e.cantidad);
      else await deps.repo.acreditarSaldo(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, bodegaId: e.bodegaId, productoId: e.productoId, loteId: e.loteId, cantidad: e.cantidad });
      const id = await deps.ops.insertarMovimientoConClave(tx, {
        organizacionId: ctx.organizacionId,
        fincaId: e.fincaId,
        bodegaId: e.bodegaId,
        productoId: e.productoId,
        loteId: e.loteId,
        tipo: e.tipo,
        delta: resta ? `-${e.cantidad}` : e.cantidad,
        origenTipo: "ajuste",
        origenId: null,
        creadoPor: ctx.usuarioId,
        nota: e.motivo,
        clave,
      });
      await deps.auditor.registrar(
        { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: `inventario.${e.tipo}`, entidad: "movimiento_inventario", entidadId: id, resultado: "ok", despues: { delta: resta ? `-${e.cantidad}` : e.cantidad, motivo: e.motivo }, ip: ctx.ip },
        tx,
      );
      return { movimientoId: id, repetida: false };
    });
  } catch (error) {
    if (error instanceof ErrorClaveDuplicada) {
      const previo = await deps.uow.consultar((tx) => deps.ops.buscarMovimientoPorClave(tx, ctx.organizacionId, clave));
      if (previo) return { movimientoId: previo.id, repetida: true };
    }
    await auditarError(deps, ctx, `inventario.${e.tipo}`, error);
    throw error;
  }
}

// ───────────── Traslados ─────────────

const esquemaTraslado = z.object({
  fincaId: uuid,
  bodegaOrigenId: uuid,
  bodegaDestinoId: uuid,
  productoId: uuid,
  loteId: uuid,
  cantidad: cantidadPositiva,
  claveIdempotencia: z.string().min(8).max(100),
});

export async function trasladar(deps: DependenciasOperaciones, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaTraslado, cruda, "Revise los datos del traslado");
  await autorizar(deps.auditor, ctx, "inventario:trasladar", { accion: "inventario.trasladar", entidad: "movimiento_inventario", fincaId: e.fincaId });
  if (e.bodegaOrigenId === e.bodegaDestinoId) throw new ErrorRegla("La bodega de origen y la de destino deben ser distintas");
  const claveBase = `tr:${ctx.organizacionId}:${e.claveIdempotencia}`;
  try {
    return await deps.uow.ejecutar(async (tx) => {
      const previo = await deps.ops.buscarMovimientoPorClave(tx, ctx.organizacionId, `${claveBase}:s`);
      if (previo) return { trasladoId: previo.origenId as string, repetida: true };
      for (const bodegaId of [e.bodegaOrigenId, e.bodegaDestinoId]) {
        if (!(await deps.ops.ubicacionValida(tx, ctx.organizacionId, { fincaId: e.fincaId, bodegaId, productoId: e.productoId, loteId: e.loteId }))) {
          throw new ErrorRegla("Bodega, lote o producto no válidos para la finca", "ubicacion_invalida");
        }
      }
      // Bloqueo en orden de id para que dos traslados cruzados no se bloqueen mutuamente.
      const [primera, segunda] = [e.bodegaOrigenId, e.bodegaDestinoId].sort();
      await deps.ops.bloquearSaldoExacto(tx, { bodegaId: primera, productoId: e.productoId, loteId: e.loteId });
      await deps.ops.bloquearSaldoExacto(tx, { bodegaId: segunda, productoId: e.productoId, loteId: e.loteId });
      await restar(deps, tx, { bodegaId: e.bodegaOrigenId, productoId: e.productoId, loteId: e.loteId }, e.cantidad);
      await deps.repo.acreditarSaldo(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, bodegaId: e.bodegaDestinoId, productoId: e.productoId, loteId: e.loteId, cantidad: e.cantidad });
      const trasladoId = randomUUID();
      const base = { organizacionId: ctx.organizacionId, fincaId: e.fincaId, productoId: e.productoId, loteId: e.loteId, origenTipo: "traslado", origenId: trasladoId, creadoPor: ctx.usuarioId };
      await deps.ops.insertarMovimientoConClave(tx, { ...base, bodegaId: e.bodegaOrigenId, tipo: "traslado_salida", delta: `-${e.cantidad}`, clave: `${claveBase}:s` });
      await deps.ops.insertarMovimientoConClave(tx, { ...base, bodegaId: e.bodegaDestinoId, tipo: "traslado_entrada", delta: e.cantidad, clave: `${claveBase}:e` });
      await deps.auditor.registrar(
        { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "inventario.trasladar", entidad: "movimiento_inventario", entidadId: trasladoId, resultado: "ok", despues: { cantidad: e.cantidad }, ip: ctx.ip },
        tx,
      );
      return { trasladoId, repetida: false };
    });
  } catch (error) {
    await auditarError(deps, ctx, "inventario.trasladar", error);
    throw error;
  }
}

// ───────────── Transformaciones (cereza → pergamino → excelso) ─────────────

const esquemaTransformacion = z.object({
  fincaId: uuid,
  bodegaId: uuid,
  tipo: z.string().trim().min(3).max(80),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  factorRendimiento: z.string().regex(/^\d{1,4}(\.\d{1,3})?$/).optional(),
  nota: z.string().max(300).optional(),
  claveIdempotencia: z.string().min(8).max(100),
  lineas: z
    .array(
      z.object({
        loteId: uuid,
        productoEntradaId: uuid,
        productoSalidaId: uuid,
        cantidadEntrada: cantidadPositiva,
        cantidadSalida: cantidadPositiva,
      }),
    )
    .min(1)
    .max(30),
});

/** La transformación conserva el lote de origen: cada línea consume y produce del MISMO lote (trazabilidad D2). */
export async function transformar(deps: DependenciasOperaciones, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaTransformacion, cruda, "Revise los datos de la transformación");
  await autorizar(deps.auditor, ctx, "inventario:transformar", { accion: "inventario.transformar", entidad: "transformacion", fincaId: e.fincaId });
  const clave = `tf:${ctx.organizacionId}:${e.claveIdempotencia}`;
  try {
    return await deps.uow.ejecutar(async (tx) => {
      const previa = await deps.ops.transformacionPorClave(tx, ctx.organizacionId, clave);
      if (previa) return { transformacionId: previa, repetida: true };
      const id = randomUUID();
      await deps.ops.insertarTransformacion(tx, {
        id,
        organizacionId: ctx.organizacionId,
        fincaId: e.fincaId,
        bodegaId: e.bodegaId,
        tipo: e.tipo,
        fecha: e.fecha,
        factorRendimiento: e.factorRendimiento ?? null,
        clave,
        creadoPor: ctx.usuarioId,
        nota: e.nota,
      });
      const ordenadas = [...e.lineas].sort((a, b) => (a.loteId + a.productoEntradaId).localeCompare(b.loteId + b.productoEntradaId));
      for (const l of ordenadas) {
        const entrada = aEscala(l.cantidadEntrada, ESCALA_CANTIDAD);
        const salida = aEscala(l.cantidadSalida, ESCALA_CANTIDAD);
        if (salida > entrada) throw new ErrorRegla("La cantidad producida no puede superar la cantidad transformada");
        for (const productoId of [l.productoEntradaId, l.productoSalidaId]) {
          if (!(await deps.ops.ubicacionValida(tx, ctx.organizacionId, { fincaId: e.fincaId, bodegaId: e.bodegaId, productoId, loteId: l.loteId }))) {
            throw new ErrorRegla("Bodega, lote o producto no válidos para la finca", "ubicacion_invalida");
          }
        }
        await restar(deps, tx, { bodegaId: e.bodegaId, productoId: l.productoEntradaId, loteId: l.loteId }, l.cantidadEntrada);
        await deps.repo.acreditarSaldo(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, bodegaId: e.bodegaId, productoId: l.productoSalidaId, loteId: l.loteId, cantidad: l.cantidadSalida });
        const base = { organizacionId: ctx.organizacionId, fincaId: e.fincaId, bodegaId: e.bodegaId, loteId: l.loteId, origenTipo: "transformacion", origenId: id, creadoPor: ctx.usuarioId, clave: null };
        await deps.ops.insertarMovimientoConClave(tx, { ...base, productoId: l.productoEntradaId, tipo: "transformacion_salida", delta: `-${l.cantidadEntrada}` });
        await deps.ops.insertarMovimientoConClave(tx, { ...base, productoId: l.productoSalidaId, tipo: "transformacion_entrada", delta: l.cantidadSalida });
        await deps.ops.insertarLineaTransformacion(tx, {
          transformacionId: id,
          fincaId: e.fincaId,
          loteId: l.loteId,
          productoEntradaId: l.productoEntradaId,
          productoSalidaId: l.productoSalidaId,
          cantidadEntrada: l.cantidadEntrada,
          cantidadSalida: l.cantidadSalida,
          cantidadPerdida: deEscala(entrada - salida, ESCALA_CANTIDAD),
        });
      }
      await deps.auditor.registrar(
        { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "inventario.transformar", entidad: "transformacion", entidadId: id, resultado: "ok", despues: { tipo: e.tipo, lineas: e.lineas.length }, ip: ctx.ip },
        tx,
      );
      return { transformacionId: id, repetida: false };
    });
  } catch (error) {
    if (error instanceof ErrorClaveDuplicada) {
      const previa = await deps.uow.consultar((tx) => deps.ops.transformacionPorClave(tx, ctx.organizacionId, clave));
      if (previa) return { transformacionId: previa, repetida: true };
    }
    await auditarError(deps, ctx, "inventario.transformar", error);
    throw error;
  }
}

// ───────────── Reversos ─────────────

const esquemaReverso = z.object({ movimientoId: uuid, motivo });

/**
 * Los movimientos confirmados no se editan ni se borran: se corrigen con un reverso auditado.
 * Solo se reversan ajustes y movimientos manuales; ventas, cosechas y transformaciones tienen su propio flujo.
 */
export async function reversarMovimiento(deps: DependenciasOperaciones, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaReverso, cruda, "Revise los datos del reverso");
  await autorizar(deps.auditor, ctx, "inventario:reversar", { accion: "inventario.reversar", entidad: "movimiento_inventario" });
  try {
    return await deps.uow.ejecutar(async (tx) => {
      const original = await deps.ops.obtenerMovimiento(tx, ctx.organizacionId, e.movimientoId);
      if (!original || !ctx.fincaIds.includes(original.fincaId)) throw new ErrorNoEncontrado("Movimiento");
      if (!["ajuste", "manual"].includes(original.origenTipo) || original.tipo === "reverso") {
        throw new ErrorRegla("Este movimiento no se puede reversar directamente", "no_reversible");
      }
      const saldo = await deps.ops.bloquearSaldoExacto(tx, { bodegaId: original.bodegaId, productoId: original.productoId, loteId: original.loteId });
      if (await deps.ops.yaReversado(tx, original.id)) throw new ErrorRegla("El movimiento ya fue reversado", "ya_reversado");
      const delta = aEscala(original.delta, ESCALA_CANTIDAD);
      const reverso = -delta;
      if (reverso < 0n) {
        const disponible = saldo ? aEscala(saldo.cantidad, ESCALA_CANTIDAD) : 0n;
        if (!saldo || disponible < -reverso) throw new ErrorRegla("No se puede reversar: dejaría existencias negativas", "reverso_deja_negativo");
        await deps.repo.descontarSaldo(tx, saldo.id, deEscala(-reverso, ESCALA_CANTIDAD));
      } else {
        await deps.repo.acreditarSaldo(tx, { organizacionId: ctx.organizacionId, fincaId: original.fincaId, bodegaId: original.bodegaId, productoId: original.productoId, loteId: original.loteId, cantidad: deEscala(reverso, ESCALA_CANTIDAD) });
      }
      const id = await deps.ops.insertarMovimientoConClave(tx, {
        organizacionId: ctx.organizacionId,
        fincaId: original.fincaId,
        bodegaId: original.bodegaId,
        productoId: original.productoId,
        loteId: original.loteId,
        tipo: "reverso",
        delta: deEscala(reverso, ESCALA_CANTIDAD),
        origenTipo: "reverso",
        origenId: original.id,
        revierteA: original.id,
        creadoPor: ctx.usuarioId,
        nota: e.motivo,
        clave: null,
      });
      await deps.auditor.registrar(
        { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "inventario.reversar", entidad: "movimiento_inventario", entidadId: id, resultado: "ok", antes: { movimientoId: original.id, delta: original.delta }, despues: { delta: deEscala(reverso, ESCALA_CANTIDAD), motivo: e.motivo }, ip: ctx.ip },
        tx,
      );
      return { reversoId: id };
    });
  } catch (error) {
    await auditarError(deps, ctx, "inventario.reversar", error);
    throw error;
  }
}

export async function listarMovimientos(
  deps: DependenciasOperaciones,
  ctx: ContextoUsuario,
  pagina: number,
  porPagina = 25,
): Promise<{ filas: FilaMovimiento[]; total: number }> {
  await autorizar(deps.auditor, ctx, "inventario:ver", { accion: "inventario.movimientos", entidad: "movimiento_inventario" });
  const limite = Math.min(Math.max(porPagina, 1), 50);
  return deps.uow.consultar((tx) => deps.ops.listarMovimientos(tx, ctx.organizacionId, ctx.fincaIds, limite, (Math.max(pagina, 1) - 1) * limite));
}
