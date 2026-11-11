/**
 * Beneficio y poscosecha (extensión 2). Los flujos de proceso son configurables por tipo de producto: no todo el café
 * pasa por las mismas etapas. Cada etapa ejecutada es una transformación de inventario (movimientos inmutables) que
 * consume y produce del MISMO lote, así la trazabilidad cereza → pergamino húmedo → pergamino seco → excelso se conserva.
 */
import { z } from "zod";
import { transformar, type DependenciasOperaciones } from "@/modules/inventario/application/operaciones";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, deEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { ErrorNoEncontrado, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioBeneficio } from "../domain/puertos";

export interface DependenciasBeneficio {
  repo: RepositorioBeneficio;
  operaciones: DependenciasOperaciones;
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
const uuid = z.string().uuid();
const cantidadTxt = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida (máximo 3 decimales)");

const esquemaProceso = z.object({
  codigo: z.string().trim().regex(/^[a-z0-9_]{3,40}$/, "Use minúsculas, números o guion bajo (3 a 40)"),
  nombre: z.string().trim().min(3, "Indique el nombre").max(100),
  etapas: z
    .array(
      z.object({
        codigo: z.string().trim().regex(/^[a-z0-9_]{3,40}$/, "Código de etapa inválido"),
        nombre: z.string().trim().min(3).max(100),
        productoEntradaId: uuid,
        productoSalidaId: uuid,
        mermaEsperadaPct: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Porcentaje inválido").optional(),
      }),
    )
    .min(1, "El proceso necesita al menos una etapa")
    .max(15),
});

export async function crearProcesoTipo(deps: DependenciasBeneficio, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaProceso, cruda, "Revise los datos del proceso");
  await autorizar(deps.auditor, ctx, "proceso:administrar", { accion: "proceso.crear", entidad: "proceso_tipo" });
  // Las etapas se encadenan: lo que sale de una es lo que entra a la siguiente.
  e.etapas.forEach((et, i) => {
    if (et.mermaEsperadaPct !== undefined && Number(et.mermaEsperadaPct) > 100) throw new ErrorValidacion("La merma no puede superar 100 %", { [`etapas.${i}.mermaEsperadaPct`]: "Inválida" });
    if (i > 0 && et.productoEntradaId !== e.etapas[i - 1].productoSalidaId) {
      throw new ErrorRegla(`La etapa ${i + 1} debe recibir el producto que produce la etapa ${i}`, "etapas_no_encadenadas");
    }
  });
  return deps.uow.ejecutar(async (tx) => {
    const ids = [...new Set(e.etapas.flatMap((et) => [et.productoEntradaId, et.productoSalidaId]))];
    if (!(await deps.repo.productosExisten(tx, ctx.organizacionId, ids))) throw new ErrorRegla("Algún producto del proceso no existe", "producto_invalido");
    const id = await deps.repo.crearProceso(tx, { organizacionId: ctx.organizacionId, codigo: e.codigo, nombre: e.nombre, creadoPor: ctx.usuarioId, etapas: e.etapas });
    await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "proceso.crear", entidad: "proceso_tipo", entidadId: id, resultado: "ok", despues: { codigo: e.codigo, etapas: e.etapas.length }, ip: ctx.ip }, tx);
    return { id };
  });
}

export async function listarProcesos(deps: DependenciasBeneficio, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "proceso:ver", { accion: "proceso.listar", entidad: "proceso_tipo" });
  return deps.uow.consultar((tx) => deps.repo.listarProcesos(tx, ctx.organizacionId));
}

const esquemaEtapa = z.object({
  etapaId: uuid,
  fincaId: uuid,
  bodegaId: uuid,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  claveIdempotencia: z.string().min(8).max(100),
  justificacion: z.string().trim().max(300).optional(),
  lineas: z.array(z.object({ loteId: uuid, cantidadEntrada: cantidadTxt, cantidadSalida: cantidadTxt })).min(1, "Indique al menos un lote").max(30),
});

/**
 * Registra una etapa: entrada, salida, pérdida, responsable, fecha y lotes de origen. Si la merma supera la esperada de
 * la etapa (parámetro configurable) se exige una justificación, que queda en el registro y en la auditoría.
 */
export async function ejecutarEtapa(deps: DependenciasBeneficio, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaEtapa, cruda, "Revise los datos de la etapa");
  await autorizar(deps.auditor, ctx, "proceso:registrar", { accion: "proceso.registrar", entidad: "proceso_registro", fincaId: e.fincaId });
  const etapa = await deps.uow.consultar((tx) => deps.repo.obtenerEtapa(tx, ctx.organizacionId, e.etapaId));
  if (!etapa) throw new ErrorNoEncontrado("Etapa");

  let entrada = 0n;
  let salida = 0n;
  for (const l of e.lineas) {
    const ent = aEscala(l.cantidadEntrada, ESCALA_CANTIDAD);
    const sal = aEscala(l.cantidadSalida, ESCALA_CANTIDAD);
    if (ent <= 0n || sal <= 0n) throw new ErrorValidacion("Las cantidades deben ser mayores que cero", { lineas: "Cantidad inválida" });
    if (sal > ent) throw new ErrorRegla("La cantidad producida no puede superar la cantidad procesada", "salida_mayor_que_entrada");
    entrada += ent;
    salida += sal;
  }
  const perdida = entrada - salida;
  const mermaCentesimas = (perdida * 10_000n + entrada / 2n) / entrada; // porcentaje con 2 decimales
  const excede = etapa.mermaEsperadaPct !== null && mermaCentesimas > BigInt(Math.round(Number(etapa.mermaEsperadaPct) * 100));
  if (excede && !e.justificacion) {
    throw new ErrorValidacion(`La merma (${deEscala(mermaCentesimas, 2)} %) supera la esperada (${etapa.mermaEsperadaPct} %). Justifique la diferencia.`, { justificacion: "Obligatoria" });
  }

  const resultado = await transformar(deps.operaciones, ctx, {
    fincaId: e.fincaId,
    bodegaId: e.bodegaId,
    tipo: `${etapa.procesoNombre}: ${etapa.nombre}`,
    fecha: e.fecha,
    claveIdempotencia: e.claveIdempotencia,
    nota: e.justificacion,
    lineas: e.lineas.map((l) => ({ loteId: l.loteId, productoEntradaId: etapa.productoEntradaId, productoSalidaId: etapa.productoSalidaId, cantidadEntrada: l.cantidadEntrada, cantidadSalida: l.cantidadSalida })),
  });

  // El movimiento de inventario ya es un hecho confirmado; el registro del proceso es idempotente por transformación.
  return deps.uow.ejecutar(async (tx) => {
    const previo = await deps.repo.registroPorTransformacion(tx, resultado.transformacionId);
    if (previo) return { registroId: previo, transformacionId: resultado.transformacionId, mermaPct: deEscala(mermaCentesimas, 2), repetido: true };
    const id = await deps.repo.insertarRegistro(tx, {
      organizacionId: ctx.organizacionId, fincaId: e.fincaId, procesoTipoId: etapa.procesoTipoId, etapaId: etapa.id, transformacionId: resultado.transformacionId,
      fecha: e.fecha, entradaTotal: deEscala(entrada, ESCALA_CANTIDAD), salidaTotal: deEscala(salida, ESCALA_CANTIDAD), perdidaTotal: deEscala(perdida, ESCALA_CANTIDAD),
      mermaPct: deEscala(mermaCentesimas, 2), excede, justificacion: e.justificacion, responsableId: ctx.usuarioId,
    });
    await deps.auditor.registrar(
      { organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "proceso.registrar", entidad: "proceso_registro", entidadId: id, resultado: "ok", despues: { etapa: etapa.codigo, mermaPct: deEscala(mermaCentesimas, 2), excede }, ip: ctx.ip },
      tx,
    );
    return { registroId: id, transformacionId: resultado.transformacionId, mermaPct: deEscala(mermaCentesimas, 2), repetido: false };
  });
}

export async function listarRegistrosProceso(deps: DependenciasBeneficio, ctx: ContextoUsuario) {
  await autorizar(deps.auditor, ctx, "proceso:ver", { accion: "proceso.historial", entidad: "proceso_registro" });
  return deps.uow.consultar((tx) => deps.repo.listarRegistros(tx, ctx.organizacionId, ctx.fincaIds, 100));
}

export type { FilaProceso, FilaRegistroProceso, EtapaProceso } from "../domain/puertos";
