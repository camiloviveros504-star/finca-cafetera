/**
 * Compras, cuentas por pagar, gastos y resumen financiero (extensión 3). Los movimientos financieros se separan de los
 * movimientos físicos de inventario. Los comprobantes son internos: no hay facturación electrónica DIAN y el resumen
 * es una herramienta de gestión, no contabilidad oficial.
 */
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, deEscala, ESCALA_CANTIDAD, ESCALA_MONTO, multiplicarCantidadPorPrecio } from "@/shared/dominio/decimal";
import { mayorQue, restar, sumar } from "@/shared/dominio/dinero";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { InsumosParaCompras, LineaCompra, RepositorioFinanzas } from "../domain/puertos";

export interface DependenciasFinanzas {
  repo: RepositorioFinanzas;
  /** Inventario de insumos: si está presente, recibir una compra suma lo comprado a las existencias. */
  insumos?: InsumosParaCompras;
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
const montoTxt = z.string().regex(/^\d{1,11}(\.\d{1,2})?$/, "Monto inválido (máximo 2 decimales)");
const cantidadTxt = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida (máximo 3 decimales)");
const uuid = z.string().uuid();
const auditar = (deps: DependenciasFinanzas, ctx: ContextoUsuario, tx: Parameters<Auditor["registrar"]>[1], accion: string, entidad: string, entidadId: string, despues: unknown) =>
  deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion, entidad, entidadId, resultado: "ok", despues, ip: ctx.ip }, tx);

// ───────────── Proveedores ─────────────

const esquemaProveedor = z.object({
  nombre: z.string().trim().min(3, "Indique el nombre").max(120),
  documento: z.preprocess(vacio, z.string().trim().max(30).optional()),
  telefono: z.preprocess(vacio, z.string().trim().max(20).optional()),
  correo: z.preprocess(vacio, z.string().trim().email("Correo inválido").optional()),
  autorizaTratamiento: z.boolean().default(false),
  fincaId: z.preprocess(vacio, uuid.optional()),
});

export async function crearProveedor(deps: DependenciasFinanzas, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaProveedor, cruda, "Revise los datos del proveedor");
  // Cada finca maneja sus proveedores: sin finca indicada, quien no administra la plataforma los crea en su primera finca.
  const fincaId = e.fincaId ?? (ctx.permisos.has("finca:administrar") ? undefined : ctx.fincaIds[0]);
  await autorizar(deps.auditor, ctx, "proveedor:administrar", { accion: "proveedor.crear", entidad: "proveedor", fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearProveedor(tx, { organizacionId: ctx.organizacionId, ...e, fincaId });
    await auditar(deps, ctx, tx, "proveedor.crear", "proveedor", id, { nombre: e.nombre });
    return { id };
  });
}

export async function listarProveedores(deps: DependenciasFinanzas, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "proveedor:ver", { accion: "proveedor.listar", entidad: "proveedor" });
  return deps.uow.consultar((tx) => deps.repo.listarProveedores(tx, ctx.organizacionId, ctx.fincaIds));
}

// ───────────── Compras: pedido → recepción → cuenta por pagar → pagos ─────────────

const esquemaCompra = z.object({
  fincaId: uuid,
  proveedorId: uuid,
  fecha,
  nota: z.preprocess(vacio, z.string().trim().max(300).optional()),
  claveIdempotencia: z.string().min(8).max(100),
  lineas: z
    .array(z.object({ insumoId: z.preprocess(vacio, uuid.optional()), descripcion: z.preprocess(vacio, z.string().trim().min(2, "Describa el insumo").max(150).optional()), cantidad: cantidadTxt, unidad: z.string().trim().min(1).max(20), costoUnitario: montoTxt }))
    .min(1, "Agregue al menos un insumo")
    .max(50),
});

export async function registrarCompra(deps: DependenciasFinanzas, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaCompra, cruda, "Revise los datos de la compra");
  await autorizar(deps.auditor, ctx, "compra:crear", { accion: "compra.crear", entidad: "compra", fincaId: e.fincaId });
  for (const l of e.lineas) if (!l.insumoId && !l.descripcion) throw new ErrorValidacion("Elija el insumo o describa lo que compró", { lineas: "Falta el insumo" });
  const lineas: LineaCompra[] = e.lineas.map((l) => {
    const cantidad = aEscala(l.cantidad, ESCALA_CANTIDAD);
    if (cantidad <= 0n) throw new ErrorValidacion("La cantidad debe ser mayor que cero", { lineas: "Cantidad inválida" });
    return { insumoId: l.insumoId, descripcion: l.descripcion ?? "", cantidad: l.cantidad, unidad: l.unidad, costoUnitario: l.costoUnitario, subtotal: deEscala(multiplicarCantidadPorPrecio(cantidad, aEscala(l.costoUnitario, ESCALA_MONTO)), ESCALA_MONTO) };
  });
  const total = sumar(lineas.map((l) => l.subtotal));
  if (!mayorQue(total, "0.00")) throw new ErrorValidacion("El total de la compra debe ser mayor que cero", { lineas: "Total en cero" });
  return deps.uow.ejecutar(async (tx) => {
    const previa = await deps.repo.buscarCompraPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previa) return { id: previa, total, repetida: true };
    if (!(await deps.repo.proveedorExiste(tx, ctx.organizacionId, e.proveedorId))) throw new ErrorNoEncontrado("Proveedor");
    for (const l of lineas) {
      if (!l.insumoId) continue;
      const nombre = deps.insumos ? await deps.insumos.nombre(tx, ctx.organizacionId, e.fincaId, l.insumoId) : null;
      if (!nombre) throw new ErrorRegla("El insumo no existe en esta finca", "insumo_invalido");
      if (!l.descripcion) l.descripcion = nombre;
    }
    const id = await deps.repo.insertarCompra(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, proveedorId: e.proveedorId, fecha: e.fecha, total, clave: e.claveIdempotencia, creadoPor: ctx.usuarioId, nota: e.nota, lineas });
    await auditar(deps, ctx, tx, "compra.crear", "compra", id, { proveedorId: e.proveedorId, total, lineas: lineas.length });
    return { id, total, repetida: false };
  });
}

/** La recepción convierte el pedido en una cuenta por pagar. Solo se recibe una vez. */
export async function recibirCompra(deps: DependenciasFinanzas, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ compraId: uuid, fecha }), cruda, "Revise los datos de la recepción");
  await autorizar(deps.auditor, ctx, "compra:recibir", { accion: "compra.recibir", entidad: "compra" });
  return deps.uow.ejecutar(async (tx) => {
    const c = await deps.repo.bloquearCompra(tx, ctx.organizacionId, e.compraId);
    if (!c || !ctx.fincaIds.includes(c.fincaId)) throw new ErrorNoEncontrado("Compra");
    if (c.estado !== "pedida") throw new ErrorRegla("La compra ya fue recibida", "compra_ya_recibida");
    await deps.repo.marcarRecibida(tx, c.id, e.fecha, ctx.usuarioId);
    // Lo comprado entra al inventario de insumos de la finca (bultos, litros, unidades).
    if (deps.insumos) {
      for (const l of await deps.repo.lineasDeInsumo(tx, c.id)) {
        await deps.insumos.acreditar(tx, { organizacionId: ctx.organizacionId, fincaId: c.fincaId, insumoId: l.insumoId, cantidad: l.cantidad, fecha: e.fecha, referencia: `Compra recibida el ${e.fecha}`, usuarioId: ctx.usuarioId });
      }
    }
    await auditar(deps, ctx, tx, "compra.recibir", "compra", c.id, { fecha: e.fecha, total: c.total });
    return { id: c.id };
  });
}

const esquemaPagoCompra = z.object({ compraId: uuid, monto: montoTxt, metodo: z.string().trim().min(2, "Indique el método"), fecha, claveIdempotencia: z.string().min(8).max(100) });

export async function pagarCompra(deps: DependenciasFinanzas, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaPagoCompra, cruda, "Revise los datos del pago");
  if (!mayorQue(e.monto, "0.00")) throw new ErrorValidacion("El monto debe ser mayor que cero", { monto: "Monto inválido" });
  await autorizar(deps.auditor, ctx, "pago_proveedor:registrar", { accion: "pago_proveedor.registrar", entidad: "pago_proveedor" });
  return deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.buscarPagoProveedorPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previo) return { id: previo, repetido: true };
    if (!(await deps.repo.metodoExiste(tx, ctx.organizacionId, e.metodo, ctx.fincaIds))) throw new ErrorRegla("Método de pago no configurado", "metodo_pago_invalido");
    const c = await deps.repo.bloquearCompra(tx, ctx.organizacionId, e.compraId);
    if (!c || !ctx.fincaIds.includes(c.fincaId)) throw new ErrorNoEncontrado("Compra");
    if (c.estado !== "recibida") throw new ErrorRegla("Solo se paga una compra ya recibida", "compra_no_recibida");
    const saldo = restar(c.total, c.pagado);
    if (mayorQue(e.monto, saldo)) throw new ErrorRegla(`El pago supera el saldo pendiente (${saldo})`, "pago_excede_saldo");
    const id = await deps.repo.insertarPagoProveedor(tx, { organizacionId: ctx.organizacionId, compraId: e.compraId, monto: e.monto, metodo: e.metodo, fecha: e.fecha, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId });
    await auditar(deps, ctx, tx, "pago_proveedor.registrar", "pago_proveedor", id, { compraId: e.compraId, monto: e.monto });
    return { id, repetido: false };
  });
}

export async function listarCompras(deps: DependenciasFinanzas, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "compra:ver", { accion: "compra.listar", entidad: "compra" });
  return deps.uow.consultar((tx) => deps.repo.listarCompras(tx, ctx.organizacionId, ctx.fincaIds));
}

// ───────────── Gastos ─────────────

const esquemaGasto = z.object({
  fincaId: uuid,
  ventaId: z.preprocess(vacio, uuid.optional()),
  loteId: z.preprocess(vacio, uuid.optional()),
  tipo: z.string().trim().min(2, "Seleccione el tipo de gasto"),
  clasificacion: z.enum(["agricola", "administrativo"], { message: "Clasificación inválida" }),
  fecha,
  descripcion: z.string().trim().min(3, "Describa el gasto").max(200),
  monto: montoTxt,
  metodo: z.preprocess(vacio, z.string().trim().optional()),
  claveIdempotencia: z.string().min(8).max(100),
});

export async function registrarGasto(deps: DependenciasFinanzas, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaGasto, cruda, "Revise los datos del gasto");
  if (!mayorQue(e.monto, "0.00")) throw new ErrorValidacion("El monto debe ser mayor que cero", { monto: "Monto inválido" });
  await autorizar(deps.auditor, ctx, "gasto:registrar", { accion: "gasto.registrar", entidad: "gasto", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.buscarGastoPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
    if (previo) return { id: previo, repetido: true };
    if (!(await deps.repo.tipoGastoExiste(tx, ctx.organizacionId, e.tipo, ctx.fincaIds))) throw new ErrorRegla("Tipo de gasto no configurado", "tipo_gasto_invalido");
    if (e.metodo && !(await deps.repo.metodoExiste(tx, ctx.organizacionId, e.metodo, ctx.fincaIds))) throw new ErrorRegla("Método de pago no configurado", "metodo_pago_invalido");
    if (e.loteId && !(await deps.repo.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, e.fincaId))) throw new ErrorRegla("El lote no pertenece a la finca indicada", "lote_invalido");
    if (e.ventaId && !(await deps.repo.ventaEsDeFinca(tx, ctx.organizacionId, e.ventaId, e.fincaId))) throw new ErrorRegla("La venta no pertenece a la finca indicada", "venta_invalida");
    const id = await deps.repo.insertarGasto(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, ventaId: e.ventaId, loteId: e.loteId, tipo: e.tipo, clasificacion: e.clasificacion, fecha: e.fecha, descripcion: e.descripcion, monto: e.monto, metodo: e.metodo, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId });
    await auditar(deps, ctx, tx, "gasto.registrar", "gasto", id, { tipo: e.tipo, monto: e.monto });
    return { id, repetido: false };
  });
}

export async function listarGastos(deps: DependenciasFinanzas, ctx: ContextoUsuario, desde: string, hasta: string) {
  await autorizar(deps.auditor, ctx, "gasto:ver", { accion: "gasto.listar", entidad: "gasto" });
  return deps.uow.consultar((tx) => deps.repo.listarGastos(tx, ctx.organizacionId, ctx.fincaIds, desde, hasta));
}

// ───────────── Resumen financiero y conciliación ─────────────

const esquemaPeriodo = z.object({ desde: fecha, hasta: fecha });

export async function obtenerResumenFinanciero(deps: DependenciasFinanzas, ctx: ContextoUsuario, desde: string, hasta: string) {
  const p = validar(esquemaPeriodo, { desde, hasta }, "Revise el período");
  if (p.hasta < p.desde) throw new ErrorValidacion("El período es inválido", { hasta: "Debe ser posterior al inicio" });
  await autorizar(deps.auditor, ctx, "finanzas:ver", { accion: "finanzas.resumen", entidad: "finanzas" });
  return deps.uow.consultar((tx) => deps.repo.resumen(tx, ctx.organizacionId, ctx.fincaIds, p.desde, p.hasta));
}

/** Conciliación interna de los movimientos de dinero registrados; no sustituye una conciliación bancaria. */
export async function obtenerConciliacion(deps: DependenciasFinanzas, ctx: ContextoUsuario, desde: string, hasta: string) {
  const p = validar(esquemaPeriodo, { desde, hasta }, "Revise el período");
  if (p.hasta < p.desde) throw new ErrorValidacion("El período es inválido", { hasta: "Debe ser posterior al inicio" });
  await autorizar(deps.auditor, ctx, "finanzas:ver", { accion: "finanzas.conciliacion", entidad: "finanzas" });
  return deps.uow.consultar((tx) => deps.repo.conciliacion(tx, ctx.organizacionId, ctx.fincaIds, p.desde, p.hasta));
}

export type { Conciliacion, FilaCompra, FilaGasto, FilaProveedor, MovimientoFinanciero, ResumenFinanciero } from "../domain/puertos";
