import { randomUUID } from "node:crypto";
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, aplicarFactor, deEscala, ESCALA_CANTIDAD, ESCALA_MONTO, multiplicarCantidadPorPrecio } from "@/shared/dominio/decimal";
import {
  ErrorClaveDuplicada,
  ErrorExistenciasInsuficientes,
  ErrorNegocio,
  ErrorNoEncontrado,
  ErrorValidacion,
  ErrorRegla,
} from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { factorAKilos, obtenerPrecioVigente } from "@/modules/configuracion/application/consultas";
import type { RepositorioConfiguracion } from "@/modules/configuracion/application/consultas";
import { descontarParaVenta } from "@/modules/inventario/application/movimientos";
import type { RepositorioInventario } from "@/modules/inventario/application/movimientos";
import type { FilaVenta, RepositorioVentas, VentaRegistrada } from "../domain/puertos";

export interface DependenciasComercial {
  ventas: RepositorioVentas;
  inventario: RepositorioInventario;
  configuracion: RepositorioConfiguracion;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

const cantidadTexto = z
  .string()
  .regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida (máximo 3 decimales)")
  .refine((v) => aEscala(v, ESCALA_CANTIDAD) > 0n, "La cantidad debe ser mayor que cero");

export const esquemaVenta = z.object({
  fincaId: z.string().uuid(),
  clienteId: z.string().uuid(),
  claveIdempotencia: z.string().min(8).max(100),
  nota: z.string().max(500).optional(),
  /** Descuento autorizado (%): requiere permiso `venta:descontar` y no puede superar el máximo configurado. */
  /** Datos opcionales de la venta (calidad y destino). */
  variedad: z.string().trim().max(80).optional(),
  taza: z.string().trim().max(120).optional(),
  destino: z.string().trim().max(120).optional(),
  descuentoPct: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Descuento inválido").optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: cantidadTexto,
        loteId: z.string().uuid().optional(),
        bodegaId: z.string().uuid().optional(),
        /** Unidad en que se vende: la cantidad y el precio vienen en esa unidad y se pasan a kilos con la equivalencia vigente. */
        unidad: z.enum(["kg", "arroba", "carga"]).default("kg"),
        /** Precio por unidad pactado en esta venta (por kg si la unidad es kg). Si se omite se usa la tarifa vigente del producto. */
        precioKg: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Precio inválido (máximo 2 decimales)").optional(),
      }),
    )
    .min(1, "Agregue al menos un producto")
    .max(50),
});

export type EntradaVenta = z.infer<typeof esquemaVenta>;
export interface ResultadoVenta {
  venta: VentaRegistrada;
  repetida: boolean;
}

/**
 * Caso de uso central de D1: valida existencias y las descuenta en UNA transacción (ADR-002).
 * Es idempotente por `claveIdempotencia` (QA-02).
 */
export async function registrarVenta(
  deps: DependenciasComercial,
  ctx: ContextoUsuario,
  entradaCruda: unknown,
): Promise<ResultadoVenta> {
  const analizada = esquemaVenta.safeParse(entradaCruda);
  if (!analizada.success) {
    const campos: Record<string, string> = {};
    for (const p of analizada.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la venta", campos);
  }
  const entrada = analizada.data;

  await autorizar(deps.auditor, ctx, "venta:crear", {
    accion: "venta.crear",
    entidad: "venta",
    fincaId: entrada.fincaId,
  });

  const descuentoBp = entrada.descuentoPct ? aEscala(entrada.descuentoPct, 2) : 0n; // porcentaje con 2 decimales
  if (descuentoBp > 0n) {
    await autorizar(deps.auditor, ctx, "venta:descontar", { accion: "venta.descontar", entidad: "venta", fincaId: entrada.fincaId });
  }

  const repetir = (): Promise<VentaRegistrada | null> =>
    deps.uow.consultar((tx) => deps.ventas.buscarPorClave(tx, ctx.organizacionId, entrada.claveIdempotencia));

  try {
    return await deps.uow.ejecutar(async (tx) => {
      const previa = await deps.ventas.buscarPorClave(tx, ctx.organizacionId, entrada.claveIdempotencia);
      if (previa) return { venta: previa, repetida: true };

      if (!(await deps.ventas.clienteExiste(tx, ctx.organizacionId, entrada.clienteId))) {
        throw new ErrorNoEncontrado("Cliente");
      }
      const productos = [...new Set(entrada.items.map((i) => i.productoId))];
      if ((await deps.ventas.contarVendibles(tx, ctx.organizacionId, productos)) !== productos.length) {
        throw new ErrorRegla("Ese café no se puede vender en el estado en que está (por ejemplo, en lavado o en secado)", "producto_no_vendible");
      }

      const ventaId = randomUUID();
      await deps.ventas.insertarEncabezado(tx, {
        id: ventaId,
        organizacionId: ctx.organizacionId,
        fincaId: entrada.fincaId,
        clienteId: entrada.clienteId,
        clave: entrada.claveIdempotencia,
        creadoPor: ctx.usuarioId,
        nota: entrada.nota,
        variedad: entrada.variedad,
        taza: entrada.taza,
        destino: entrada.destino,
      });

      if (descuentoBp > 0n) {
        const maximo = await deps.configuracion.parametro(tx, ctx.organizacionId, entrada.fincaId, "descuento_maximo_pct");
        if (maximo === null || descuentoBp > aEscala(maximo, 2)) {
          throw new ErrorRegla(`El descuento supera el máximo autorizado (${maximo ?? "0"} %)`, "descuento_excede_maximo");
        }
      }
      const hoy = fechaColombia();
      // Venta en arrobas o cargas: se pasa a kilos con la equivalencia vigente de la finca (el inventario y la trazabilidad
      // siempre van en kilos). El precio por unidad se convierte a precio por kilo con 2 decimales.
      const items = [];
      for (const i of entrada.items) {
        if (i.unidad === "kg") { items.push(i); continue; }
        const factor = aEscala(await factorAKilos({ repo: deps.configuracion }, tx, { organizacionId: ctx.organizacionId, fincaId: entrada.fincaId, unidad: i.unidad, fecha: hoy }), 6);
        const kg = aplicarFactor(aEscala(i.cantidad, ESCALA_CANTIDAD), factor);
        const precioKg = i.precioKg === undefined ? undefined : deEscala((aEscala(i.precioKg, ESCALA_MONTO) * 1_000_000n + factor / 2n) / factor, ESCALA_MONTO);
        items.push({ ...i, cantidad: deEscala(kg, ESCALA_CANTIDAD), precioKg, unidad: "kg" as const });
      }
      // El precio lo fija quien vende (precio pactado con el comprador); si no lo indica se usa la tarifa vigente del producto.
      const precios = new Map<string, { valor: string; tarifaVersionId: string | null }>();
      for (const productoId of new Set(items.map((i) => i.productoId))) {
        const pactados = new Set(items.filter((i) => i.productoId === productoId && i.precioKg !== undefined).map((i) => i.precioKg));
        if (pactados.size > 1) throw new ErrorValidacion("Un mismo tipo de café no puede llevar dos precios en la misma venta", { items: "Precio repetido" });
        const pactado = [...pactados][0];
        if (pactado !== undefined) {
          precios.set(productoId, { valor: pactado, tarifaVersionId: null });
          continue;
        }
        precios.set(productoId, await obtenerPrecioVigente({ repo: deps.configuracion }, tx, { organizacionId: ctx.organizacionId, fincaId: entrada.fincaId, productoId, fecha: hoy }));
      }

      const salidas = await descontarParaVenta({ repo: deps.inventario }, tx, ctx, {
        ventaId,
        fincaId: entrada.fincaId,
        items,
      });

      let total = 0n;
      let descuentoTotal = 0n;
      for (const s of salidas) {
        const precio = precios.get(s.productoId);
        if (!precio) throw new ErrorValidacion("Producto sin precio");
        const subtotal = multiplicarCantidadPorPrecio(aEscala(s.cantidad, ESCALA_CANTIDAD), aEscala(precio.valor, ESCALA_MONTO));
        const descuento = (subtotal * descuentoBp + 5000n) / 10000n;
        descuentoTotal += descuento;
        total += subtotal - descuento;
        await deps.ventas.insertarDetalle(tx, {
          ventaId,
          productoId: s.productoId,
          loteId: s.loteId,
          fincaId: entrada.fincaId,
          bodegaId: s.bodegaId,
          cantidad: s.cantidad,
          precioUnitario: precio.valor,
          tarifaVersionId: precio.tarifaVersionId,
          descuento: deElSubtotal(descuento),
          subtotal: deElSubtotal(subtotal - descuento),
          movimientoId: s.movimientoId,
        });
      }
      await deps.ventas.fijarTotal(tx, ventaId, deElSubtotal(total), deElSubtotal(descuentoTotal));

      await deps.auditor.registrar(
        {
          organizacionId: ctx.organizacionId,
          usuarioId: ctx.usuarioId,
          accion: "venta.crear",
          entidad: "venta",
          entidadId: ventaId,
          resultado: "ok",
          despues: { total: deElSubtotal(total), descuento: deElSubtotal(descuentoTotal), lineas: salidas.length },
          ip: ctx.ip,
        },
        tx,
      );

      const venta = await deps.ventas.obtener(tx, ctx.organizacionId, ventaId);
      if (!venta) throw new ErrorNoEncontrado("Venta");
      return { venta, repetida: false };
    });
  } catch (error) {
    if (error instanceof ErrorClaveDuplicada) {
      const previa = await repetir();
      if (previa) return { venta: previa, repetida: true };
    }
    if (error instanceof ErrorExistenciasInsuficientes || error instanceof ErrorNegocio) {
      await deps.auditor.registrar({
        organizacionId: ctx.organizacionId,
        usuarioId: ctx.usuarioId,
        accion: "venta.crear",
        entidad: "venta",
        resultado: "error",
        despues: { codigo: error.codigo },
        ip: ctx.ip,
      });
    }
    throw error;
  }
}

function deElSubtotal(n: bigint): string {
  return deEscala(n, ESCALA_MONTO);
}

export async function listarVentas(
  deps: DependenciasComercial,
  ctx: ContextoUsuario,
  pagina: number,
  porPagina = 25,
): Promise<{ filas: FilaVenta[]; total: number }> {
  await autorizar(deps.auditor, ctx, "venta:ver", { accion: "venta.listar", entidad: "venta" });
  const limite = Math.min(Math.max(porPagina, 1), 50);
  const desplazamiento = (Math.max(pagina, 1) - 1) * limite;
  return deps.uow.consultar((tx) => deps.ventas.listar(tx, ctx.organizacionId, ctx.fincaIds, limite, desplazamiento));
}

export async function obtenerOpcionesVenta(deps: DependenciasComercial, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "venta:crear", { accion: "venta.opciones", entidad: "venta" });
  return deps.uow.consultar((tx) => deps.ventas.opcionesVenta(tx, ctx.organizacionId, ctx.fincaIds));
}
