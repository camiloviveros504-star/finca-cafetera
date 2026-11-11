import { z } from "zod";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioClientesPedidos } from "../domain/puertos";

export interface DependenciasClientes {
  repo: RepositorioClientesPedidos;
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

const vacioANada = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const esquemaCliente = z.object({
  nombre: z.string().trim().min(2, "Indique el nombre").max(150),
  documento: z.preprocess(vacioANada, z.string().trim().max(30).optional()),
  telefono: z.preprocess(vacioANada, z.string().trim().max(30).optional()),
  correo: z.preprocess(vacioANada, z.string().trim().email("Correo inválido").max(150).optional()),
  direccion: z.preprocess(vacioANada, z.string().trim().max(200).optional()),
  fincaId: z.preprocess(vacioANada, z.string().uuid().optional()),
  // Ley 1581 de 2012: sin la autorización del titular no se guardan sus datos personales.
  autorizaTratamiento: z.literal(true, { message: "Debe confirmar que el cliente autorizó el tratamiento de sus datos personales" }),
});

export async function crearCliente(deps: DependenciasClientes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaCliente, cruda, "Revise los datos del cliente");
  await autorizar(deps.auditor, ctx, "cliente:administrar", { accion: "cliente.crear", entidad: "cliente" });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearCliente(tx, { organizacionId: ctx.organizacionId, nombre: e.nombre, documento: e.documento, telefono: e.telefono, correo: e.correo, direccion: e.direccion, fincaId: e.fincaId });
    // La auditoría no guarda datos personales: solo el identificador.
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "cliente.crear", entidad: "cliente", entidadId: id, resultado: "ok", ip: ctx.ip },
      tx,
    );
    return { id };
  });
}

export async function listarClientes(deps: DependenciasClientes, ctx: ContextoUsuario, pagina: number, busqueda?: string) {
  await autorizar(deps.auditor, ctx, "cliente:ver", { accion: "cliente.listar", entidad: "cliente" });
  const limite = 25;
  const q = busqueda?.trim() ? busqueda.trim().slice(0, 80) : null;
  return deps.uow.consultar((tx) => deps.repo.listarClientes(tx, ctx.organizacionId, ctx.fincaIds, q, limite, (Math.max(pagina, 1) - 1) * limite));
}

const esquemaPedido = z.object({
  fincaId: z.string().uuid(),
  clienteId: z.string().uuid(),
  nota: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z
          .string()
          .regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida")
          .refine((v) => aEscala(v, ESCALA_CANTIDAD) > 0n, "La cantidad debe ser mayor que cero"),
      }),
    )
    .min(1, "Agregue al menos un producto")
    .max(30),
});

/** Un pedido es una intención comercial: no descuenta inventario (eso ocurre solo al confirmar la venta). */
export async function crearPedido(deps: DependenciasClientes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaPedido, cruda, "Revise los datos del pedido");
  await autorizar(deps.auditor, ctx, "pedido:crear", { accion: "pedido.crear", entidad: "pedido", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    if (!(await deps.repo.clienteExiste(tx, ctx.organizacionId, e.clienteId))) throw new ErrorNoEncontrado("Cliente");
    const ids = [...new Set(e.items.map((i) => i.productoId))];
    if ((await deps.repo.productosVendibles(tx, ctx.organizacionId, ids)) !== ids.length) throw new ErrorRegla("Hay productos no disponibles para la venta", "producto_no_vendible");
    const id = await deps.repo.crearPedido(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, clienteId: e.clienteId, creadoPor: ctx.usuarioId, nota: e.nota, items: e.items });
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "pedido.crear", entidad: "pedido", entidadId: id, resultado: "ok", despues: { lineas: e.items.length }, ip: ctx.ip },
      tx,
    );
    return { id };
  });
}

export async function listarPedidos(deps: DependenciasClientes, ctx: ContextoUsuario, pagina: number) {
  await autorizar(deps.auditor, ctx, "pedido:ver", { accion: "pedido.listar", entidad: "pedido" });
  return deps.uow.consultar((tx) => deps.repo.listarPedidos(tx, ctx.organizacionId, ctx.fincaIds, 25, (Math.max(pagina, 1) - 1) * 25));
}

/** Comprador rápido: solo el nombre. Se reutiliza si ya existe en esa finca. Para guardar datos personales use crearCliente. */
export async function registrarComprador(deps: DependenciasClientes, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ fincaId: z.string().uuid(), nombre: z.string().trim().min(2, "Indique el nombre del comprador").max(150) }), cruda, "Revise el comprador");
  await autorizar(deps.auditor, ctx, "cliente:administrar", { accion: "cliente.crear", entidad: "cliente", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.buscarOCrearComprador(tx, ctx.organizacionId, e.fincaId, e.nombre);
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "cliente.crear", entidad: "cliente", entidadId: id, resultado: "ok", ip: ctx.ip }, tx);
    return { id };
  });
}
