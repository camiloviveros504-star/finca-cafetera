import { randomUUID } from "node:crypto";
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, deEscala, ESCALA_CANTIDAD, ESCALA_MONTO, multiplicarCantidadPorPrecio } from "@/shared/dominio/decimal";
import {
  ErrorClaveDuplicada,
  ErrorExistenciasInsuficientes,
  ErrorNegocio,
  ErrorNoEncontrado,
  ErrorValidacion,
} from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { obtenerPrecioVigente } from "@/modules/configuracion/application/consultas";
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
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: cantidadTexto,
        loteId: z.string().uuid().optional(),
        bodegaId: z.string().uuid().optional(),
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

  const repetir = (): Promise<VentaRegistrada | null> =>
    deps.uow.consultar((tx) => deps.ventas.buscarPorClave(tx, ctx.organizacionId, entrada.claveIdempotencia));

  try {
    return await deps.uow.ejecutar(async (tx) => {
      const previa = await deps.ventas.buscarPorClave(tx, ctx.organizacionId, entrada.claveIdempotencia);
      if (previa) return { venta: previa, repetida: true };

      if (!(await deps.ventas.clienteExiste(tx, ctx.organizacionId, entrada.clienteId))) {
        throw new ErrorNoEncontrado("Cliente");
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
      });

      const hoy = fechaColombia();
      const precios = new Map<string, { valor: string; tarifaVersionId: string }>();
      for (const productoId of new Set(entrada.items.map((i) => i.productoId))) {
        precios.set(
          productoId,
          await obtenerPrecioVigente({ repo: deps.configuracion }, tx, {
            organizacionId: ctx.organizacionId,
            fincaId: entrada.fincaId,
            productoId,
            fecha: hoy,
          }),
        );
      }

      const salidas = await descontarParaVenta({ repo: deps.inventario }, tx, ctx, {
        ventaId,
        fincaId: entrada.fincaId,
        items: entrada.items,
      });

      let total = 0n;
      for (const s of salidas) {
        const precio = precios.get(s.productoId);
        if (!precio) throw new ErrorValidacion("Producto sin precio");
        const subtotal = multiplicarCantidadPorPrecio(aEscala(s.cantidad, ESCALA_CANTIDAD), aEscala(precio.valor, ESCALA_MONTO));
        total += subtotal;
        await deps.ventas.insertarDetalle(tx, {
          ventaId,
          productoId: s.productoId,
          loteId: s.loteId,
          fincaId: entrada.fincaId,
          bodegaId: s.bodegaId,
          cantidad: s.cantidad,
          precioUnitario: precio.valor,
          tarifaVersionId: precio.tarifaVersionId,
          subtotal: deElSubtotal(subtotal),
          movimientoId: s.movimientoId,
        });
      }
      await deps.ventas.fijarTotal(tx, ventaId, deElSubtotal(total));

      await deps.auditor.registrar(
        {
          organizacionId: ctx.organizacionId,
          usuarioId: ctx.usuarioId,
          accion: "venta.crear",
          entidad: "venta",
          entidadId: ventaId,
          resultado: "ok",
          despues: { total: deElSubtotal(total), lineas: salidas.length },
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
