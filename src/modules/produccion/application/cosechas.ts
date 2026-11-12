import { randomUUID } from "node:crypto";
import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, aplicarFactor, deEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { ErrorClaveDuplicada, ErrorNegocio, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import { obtenerFactorConversion } from "@/modules/configuracion/application/consultas";
import type { RepositorioConfiguracion } from "@/modules/configuracion/application/consultas";
import { registrarEntradaPorCosecha } from "@/modules/inventario/application/movimientos";
import type { RepositorioInventario } from "@/modules/inventario/application/movimientos";
import type { CosechaRegistrada, OpcionesRegistro, RepositorioProduccion } from "../domain/puertos";

export interface DependenciasProduccion {
  produccion: RepositorioProduccion;
  inventario: RepositorioInventario;
  configuracion: RepositorioConfiguracion;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
}

export const esquemaCosecha = z.object({
  fincaId: z.string().uuid(),
  loteId: z.string().uuid({ message: "Seleccione el lote de origen" }),
  bodegaId: z.string().uuid(),
  productoId: z.string().uuid(),
  unidadId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  cantidad: z
    .string()
    .regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida (máximo 3 decimales)")
    .refine((v) => aEscala(v, ESCALA_CANTIDAD) > 0n, "La cantidad debe ser mayor que cero"),
  /** UUID generado en el cliente: es la clave de idempotencia de la cola sin conexión. */
  claveIdempotencia: z.string().uuid(),
  capturadaEn: z.string().datetime().optional(),
  nota: z.string().max(500).optional(),
});

export type EntradaCosecha = z.infer<typeof esquemaCosecha>;
export interface ResultadoCosecha {
  cosecha: CosechaRegistrada;
  repetida: boolean;
}

/** QA-04: toda cosecha tiene lote de su finca. QA-08: idempotente por UUID del cliente. */
export async function registrarCosecha(
  deps: DependenciasProduccion,
  ctx: ContextoUsuario,
  entradaCruda: unknown,
): Promise<ResultadoCosecha> {
  const analizada = esquemaCosecha.safeParse(entradaCruda);
  if (!analizada.success) {
    const campos: Record<string, string> = {};
    for (const p of analizada.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la cosecha", campos);
  }
  const e = analizada.data;
  await autorizar(deps.auditor, ctx, "cosecha:registrar", { accion: "cosecha.registrar", entidad: "cosecha", fincaId: e.fincaId });
  // Lo recogido ya pasó: una cosecha no puede llevar fecha futura (la cola sin conexión envía la fecha del día de captura).
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha de la cosecha no puede ser futura", { fecha: "No puede ser después de hoy" });

  const repetir = () =>
    deps.uow.consultar((tx) => deps.produccion.buscarCosechaPorClave(tx, e.claveIdempotencia, ctx.organizacionId));

  try {
    return await deps.uow.ejecutar(async (tx) => {
      const previa = await deps.produccion.buscarCosechaPorClave(tx, e.claveIdempotencia, ctx.organizacionId);
      if (previa) return { cosecha: previa, repetida: true };

      if (!(await deps.produccion.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, e.fincaId))) {
        throw new ErrorRegla("El lote seleccionado no pertenece a la finca", "lote_invalido");
      }
      if (!(await deps.produccion.bodegaEsDeFinca(tx, ctx.organizacionId, e.bodegaId, e.fincaId))) {
        throw new ErrorRegla("La bodega seleccionada no pertenece a la finca", "bodega_invalida");
      }
      const unidadProducto = await deps.produccion.unidadDeProducto(tx, ctx.organizacionId, e.productoId);
      if (!unidadProducto) throw new ErrorRegla("Producto no válido", "producto_invalido");

      const factor = await obtenerFactorConversion({ repo: deps.configuracion }, tx, {
        organizacionId: ctx.organizacionId,
        fincaId: e.fincaId,
        origenId: e.unidadId,
        destinoId: unidadProducto,
        fecha: e.fecha,
      });
      const base = deEscala(aplicarFactor(aEscala(e.cantidad, ESCALA_CANTIDAD), aEscala(factor, 6)), ESCALA_CANTIDAD);
      const id = randomUUID();
      await deps.produccion.insertarCosecha(tx, {
        id,
        organizacionId: ctx.organizacionId,
        fincaId: e.fincaId,
        loteId: e.loteId,
        productoId: e.productoId,
        bodegaId: e.bodegaId,
        fecha: e.fecha,
        cantidad: e.cantidad,
        unidadId: e.unidadId,
        cantidadBase: base,
        factorAplicado: factor,
        clave: e.claveIdempotencia,
        capturadaEn: e.capturadaEn ? new Date(e.capturadaEn) : new Date(),
        registradoPor: ctx.usuarioId,
        nota: e.nota,
      });
      await registrarEntradaPorCosecha({ repo: deps.inventario }, tx, ctx, {
        cosechaId: id,
        fincaId: e.fincaId,
        bodegaId: e.bodegaId,
        productoId: e.productoId,
        loteId: e.loteId,
        cantidad: base,
      });
      await deps.auditor.registrar(
        {
          organizacionId: ctx.organizacionId,
          usuarioId: ctx.usuarioId,
          accion: "cosecha.registrar",
          entidad: "cosecha",
          entidadId: id,
          resultado: "ok",
          despues: { loteId: e.loteId, cantidadBase: base },
          ip: ctx.ip,
        },
        tx,
      );
      const cosecha = await deps.produccion.obtenerCosecha(tx, id);
      if (!cosecha) throw new ErrorRegla("No se pudo leer la cosecha registrada");
      return { cosecha, repetida: false };
    });
  } catch (error) {
    if (error instanceof ErrorClaveDuplicada) {
      const previa = await repetir();
      if (previa) return { cosecha: previa, repetida: true };
    }
    if (error instanceof ErrorNegocio) {
      await deps.auditor.registrar({
        organizacionId: ctx.organizacionId,
        usuarioId: ctx.usuarioId,
        accion: "cosecha.registrar",
        entidad: "cosecha",
        resultado: "error",
        despues: { codigo: error.codigo },
        ip: ctx.ip,
      });
    }
    throw error;
  }
}

export async function listarCosechas(deps: DependenciasProduccion, ctx: ContextoUsuario, pagina: number, porPagina = 25) {
  await autorizar(deps.auditor, ctx, "cosecha:ver", { accion: "cosecha.listar", entidad: "cosecha" });
  const limite = Math.min(Math.max(porPagina, 1), 50);
  return deps.uow.consultar((tx) =>
    deps.produccion.listarCosechas(tx, ctx.organizacionId, ctx.fincaIds, limite, (Math.max(pagina, 1) - 1) * limite),
  );
}

export async function obtenerOpcionesRegistro(deps: DependenciasProduccion, ctx: ContextoUsuario): Promise<OpcionesRegistro> {
  // Las listas de fincas, lotes, bodegas y productos las usan varias operaciones; basta con tener cualquiera de ellas.
  const permiso = ["cosecha:registrar", "inventario:ajustar", "inventario:transformar", "inventario:trasladar", "proceso:registrar", "trabajo:registrar"].find((x) => ctx.permisos.has(x)) ?? "cosecha:registrar";
  await autorizar(deps.auditor, ctx, permiso, { accion: "cosecha.opciones", entidad: "cosecha" });
  return deps.uow.consultar((tx) => deps.produccion.opcionesRegistro(tx, ctx.organizacionId, ctx.fincaIds));
}
