/**
 * Trabajadores, producción individual, liquidaciones, anticipos y pagos (extensión 1).
 * Flujo (prompt §8): el trabajador declara → el supervisor valida → el sistema calcula con la tarifa vigente
 * en la fecha de la producción → el responsable autorizado liquida y confirma el pago.
 * No es software de nómina legal: no calcula prestaciones, seguridad social ni retenciones.
 */
import { z } from "zod";
import { obtenerFactorConversion, type RepositorioConfiguracion } from "@/modules/configuracion/application/consultas";
import { autorizar } from "@/shared/aplicacion/autorizar";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, ESCALA_CANTIDAD, deEscala } from "@/shared/dominio/decimal";
import { ErrorNoEncontrado, ErrorProhibido, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import { fechaColombia } from "@/shared/dominio/fechas";
import {
  calcularValor,
  convertirAUnidadDeModalidad,
  mayorQue,
  minimo,
  repartirAnticipos,
  restar,
  sumar,
  TIPO_TARIFA_POR_MODALIDAD,
  type Modalidad,
} from "../domain/calculos";
import type { RepositorioTalento } from "../domain/puertos";

export interface DependenciasTalento {
  repo: RepositorioTalento;
  configuracion: RepositorioConfiguracion;
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
const cantidadTxt = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "Cantidad inválida (máximo 3 decimales)");
const montoTxt = z.string().regex(/^\d{1,11}(\.\d{1,2})?$/, "Monto inválido (máximo 2 decimales)");
const registrarAuditoria = (deps: DependenciasTalento, ctx: ContextoUsuario, tx: Parameters<Auditor["registrar"]>[1], accion: string, entidad: string, entidadId: string, despues: unknown) =>
  deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion, entidad, entidadId, resultado: "ok", despues, ip: ctx.ip }, tx);

// ───────────────────────────── Trabajadores y vinculaciones ─────────────────────────────

const esquemaTrabajador = z.object({
  tipoDocumento: z.enum(["CC", "CE", "TI", "PEP", "PPT", "otro"], { message: "Tipo de documento inválido" }),
  numeroDocumento: z.string().trim().regex(/^[A-Za-z0-9-]{4,20}$/, "Documento inválido"),
  nombres: z.string().trim().min(2, "Indique los nombres").max(80),
  apellidos: z.string().trim().min(2, "Indique los apellidos").max(80),
  telefono: z.preprocess(vacio, z.string().trim().max(20).optional()),
  usuarioId: z.preprocess(vacio, z.string().uuid().optional()),
  fincaId: z.preprocess(vacio, z.string().uuid().optional()),
  modalidad: z.preprocess(vacio, z.enum(["kg", "arroba", "jornada", "actividad"]).optional()),
  // Ley 1581: sin autorización explícita del titular no se guardan sus datos.
  autorizaTratamiento: z.literal(true, { message: "Debe confirmar que el trabajador autorizó el tratamiento de sus datos" }),
});

export async function crearTrabajador(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaTrabajador, cruda, "Revise los datos del trabajador");
  await autorizar(deps.auditor, ctx, "trabajador:administrar", { accion: "trabajador.crear", entidad: "trabajador", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    const id = await deps.repo.crearTrabajador(tx, {
      organizacionId: ctx.organizacionId, tipoDocumento: e.tipoDocumento, numeroDocumento: e.numeroDocumento, nombres: e.nombres, apellidos: e.apellidos,
      telefono: e.telefono, usuarioId: e.usuarioId, finalidad: "Registro de producción, liquidación y pago de remuneraciones", creadoPor: ctx.usuarioId,
    });
    // Si se indica la finca, el trabajador queda vinculado desde hoy y puede recibir registros de inmediato.
    if (e.fincaId) await deps.repo.crearVinculacion(tx, { organizacionId: ctx.organizacionId, trabajadorId: id, fincaId: e.fincaId, modalidad: e.modalidad ?? "kg", desde: fechaColombia() });
    // La auditoría no guarda el documento completo: solo lo necesario para ubicar el registro.
    await registrarAuditoria(deps, ctx, tx, "trabajador.crear", "trabajador", id, { nombres: e.nombres });
    return { id };
  });
}

const esquemaVinculacion = z.object({
  trabajadorId: z.string().uuid(),
  fincaId: z.string().uuid(),
  modalidad: z.enum(["kg", "arroba", "jornada", "actividad"], { message: "Modalidad de pago inválida" }),
  cargo: z.preprocess(vacio, z.string().trim().max(60).optional()),
  desde: fecha,
  hasta: z.preprocess(vacio, fecha.optional()),
});

export async function crearVinculacion(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaVinculacion, cruda, "Revise los datos de la vinculación");
  await autorizar(deps.auditor, ctx, "trabajador:administrar", { accion: "vinculacion.crear", entidad: "vinculacion", fincaId: e.fincaId });
  if (e.hasta && e.hasta <= e.desde) throw new ErrorValidacion("La fecha final debe ser posterior a la inicial", { hasta: "Fecha final inválida" });
  return deps.uow.ejecutar(async (tx) => {
    if (!(await deps.repo.trabajadorUsuario(tx, ctx.organizacionId, e.trabajadorId)).existe) throw new ErrorNoEncontrado("Trabajador");
    const id = await deps.repo.crearVinculacion(tx, { organizacionId: ctx.organizacionId, ...e });
    await registrarAuditoria(deps, ctx, tx, "vinculacion.crear", "vinculacion", id, { fincaId: e.fincaId, modalidad: e.modalidad });
    return { id };
  });
}

/**
 * Vincula la cuenta de acceso de un usuario (rol recolector, supervisor, etc.) con su ficha de trabajador, para que vea y
 * registre solo lo suyo. Requiere poder administrar trabajadores Y usuarios: nadie se concede acceso a sí mismo.
 */
export async function vincularUsuarioATrabajador(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(z.object({ trabajadorId: z.string().uuid(), usuarioId: z.string().uuid() }), cruda, "Revise los datos del vínculo");
  await autorizar(deps.auditor, ctx, "trabajador:administrar", { accion: "trabajador.vincular_usuario", entidad: "trabajador" });
  await autorizar(deps.auditor, ctx, "usuario:administrar", { accion: "trabajador.vincular_usuario", entidad: "trabajador" });
  return deps.uow.ejecutar(async (tx) => {
    const r = await deps.repo.vincularUsuario(tx, ctx.organizacionId, e.trabajadorId, e.usuarioId);
    if (r === "no_encontrado") throw new ErrorNoEncontrado("Trabajador o usuario");
    if (r === "trabajador_con_usuario") throw new ErrorRegla("El trabajador ya tiene una cuenta de acceso", "trabajador_con_usuario");
    if (r === "usuario_ya_vinculado") throw new ErrorRegla("Ese usuario ya está vinculado a otro trabajador", "usuario_ya_vinculado");
    await registrarAuditoria(deps, ctx, tx, "trabajador.vincular_usuario", "trabajador", e.trabajadorId, { usuarioId: e.usuarioId });
    return { ok: true };
  });
}

export async function listarTrabajadores(deps: DependenciasTalento, ctx: ContextoUsuario) {
  const propio = !ctx.permisos.has("trabajador:ver") && ctx.permisos.has("trabajador:ver_propio");
  await autorizar(deps.auditor, ctx, propio ? "trabajador:ver_propio" : "trabajador:ver", { accion: "trabajador.listar", entidad: "trabajador" });
  // Un recolector solo ve su propia fila y sus propios acumulados, nunca los de otros trabajadores.
  return deps.uow.consultar((tx) => deps.repo.listarTrabajadores(tx, ctx.organizacionId, ctx.fincaIds, propio ? ctx.usuarioId : undefined));
}

// ───────────────────────────── Producción individual ─────────────────────────────

const esquemaRegistro = z.object({
  trabajadorId: z.preprocess(vacio, z.string().uuid().optional()),
  fincaId: z.string().uuid(),
  loteId: z.preprocess(vacio, z.string().uuid().optional()),
  fecha,
  cantidad: cantidadTxt,
  unidad: z.enum(["kg", "arroba", "jornada", "actividad"], { message: "Unidad inválida" }),
  actividad: z.preprocess(vacio, z.string().trim().max(120).optional()),
  claveIdempotencia: z.string().min(8).max(100).optional(),
});

export async function registrarTrabajo(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaRegistro, cruda, "Revise los datos del registro");
  if (aEscala(e.cantidad, ESCALA_CANTIDAD) <= 0n) throw new ErrorValidacion("La cantidad debe ser mayor que cero", { cantidad: "Cantidad inválida" });
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha no puede ser futura", { fecha: "Fecha futura" });
  const registraTerceros = ctx.permisos.has("trabajo:registrar");
  await autorizar(deps.auditor, ctx, registraTerceros ? "trabajo:registrar" : "trabajo:registrar_propio", { accion: "trabajo.registrar", entidad: "registro_trabajo", fincaId: e.fincaId });
  return deps.uow.ejecutar(async (tx) => {
    if (e.claveIdempotencia) {
      const previo = await deps.repo.buscarRegistroPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
      if (previo) return { id: previo, repetido: true };
    }
    let trabajadorId = e.trabajadorId;
    if (!registraTerceros) {
      // El recolector solo registra su propia producción: no puede escribir a nombre de otro.
      const propio = await deps.repo.trabajadorDeUsuario(tx, ctx.organizacionId, ctx.usuarioId);
      if (!propio || (trabajadorId && trabajadorId !== propio)) {
        await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "trabajo.registrar", entidad: "registro_trabajo", resultado: "denegado", despues: { motivo: "registro_a_nombre_de_otro" }, ip: ctx.ip });
        throw new ErrorProhibido();
      }
      trabajadorId = propio;
    }
    if (!trabajadorId) throw new ErrorValidacion("Indique el trabajador", { trabajadorId: "Obligatorio" });
    const vinc = await deps.repo.vinculacionVigente(tx, ctx.organizacionId, trabajadorId, e.fincaId, e.fecha);
    if (!vinc) throw new ErrorRegla("El trabajador no tiene una vinculación vigente en esa finca y fecha", "sin_vinculacion");
    const masa = ["kg", "arroba"];
    if (e.unidad !== vinc.modalidad && !(masa.includes(e.unidad) && masa.includes(vinc.modalidad))) {
      throw new ErrorRegla(`La unidad ${e.unidad} no corresponde a la modalidad ${vinc.modalidad} del trabajador`, "unidad_no_corresponde");
    }
    if (vinc.modalidad === "actividad" && !e.actividad) throw new ErrorValidacion("Describa la actividad realizada", { actividad: "Obligatoria" });
    if (e.loteId && !(await deps.repo.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, e.fincaId))) throw new ErrorRegla("El lote no pertenece a la finca indicada", "lote_invalido");
    const unidadId = await deps.repo.unidadId(tx, e.unidad);
    if (!unidadId) throw new ErrorRegla("Unidad no configurada", "unidad_invalida");
    const id = await deps.repo.insertarRegistro(tx, {
      organizacionId: ctx.organizacionId, fincaId: e.fincaId, loteId: e.loteId, trabajadorId, vinculacionId: vinc.id, fecha: e.fecha,
      modalidad: vinc.modalidad, actividad: e.actividad, cantidad: e.cantidad, unidadId, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId,
    });
    await registrarAuditoria(deps, ctx, tx, "trabajo.registrar", "registro_trabajo", id, { trabajadorId, cantidad: e.cantidad, unidad: e.unidad });
    return { id, repetido: false };
  });
}

// ───────────── Recolección y labores del día, registradas por el dueño o el capataz ─────────────

export const LABORES = ["recoleccion", "abonada", "fumigacion", "plateo", "renovacion", "otra"] as const;

const esquemaJornada = z.object({
  fincaId: z.string().uuid(),
  loteId: z.preprocess(vacio, z.string().uuid().optional()),
  fecha,
  labor: z.enum(LABORES, { message: "Labor inválida" }),
  claveIdempotencia: z.string().min(8).max(100),
  lineas: z
    .array(z.object({ trabajadorId: z.string().uuid(), cantidad: cantidadTxt, unidad: z.enum(["kg", "jornada"], { message: "Unidad inválida" }), valorUnitario: montoTxt }))
    .min(1, "Agregue al menos un trabajador")
    .max(60),
});

/**
 * Registra lo que hizo cada trabajador en el día (kilos recolectados, o jornadas de abonada, fumigación, limpieza…) con el
 * valor que fija quien lo registra (por kilo o por jornal). Quien registra es el dueño o el capataz: el registro nace validado
 * y queda listo para liquidar. Idempotente por línea: reenviar el mismo formulario no duplica nada.
 */
export async function registrarJornada(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaJornada, cruda, "Revise los datos del registro");
  if (e.fecha > fechaColombia()) throw new ErrorValidacion("La fecha no puede ser futura", { fecha: "Fecha futura" });
  if (new Set(e.lineas.map((l) => l.trabajadorId)).size !== e.lineas.length) throw new ErrorValidacion("Un trabajador aparece dos veces", { lineas: "Trabajador repetido" });
  await autorizar(deps.auditor, ctx, "trabajo:registrar", { accion: "jornada.registrar", entidad: "registro_trabajo", fincaId: e.fincaId });
  await autorizar(deps.auditor, ctx, "trabajo:validar", { accion: "jornada.registrar", entidad: "registro_trabajo", fincaId: e.fincaId });
  for (const l of e.lineas) {
    if (aEscala(l.cantidad, ESCALA_CANTIDAD) <= 0n) throw new ErrorValidacion("La cantidad debe ser mayor que cero", { lineas: "Cantidad inválida" });
    if (!mayorQue(l.valorUnitario, "0.00")) throw new ErrorValidacion("El valor por kilo o por jornal debe ser mayor que cero", { lineas: "Valor inválido" });
  }
  return deps.uow.ejecutar(async (tx) => {
    if (e.loteId && !(await deps.repo.loteEsDeFinca(tx, ctx.organizacionId, e.loteId, e.fincaId))) throw new ErrorRegla("El lote no pertenece a la finca indicada", "lote_invalido");
    const ids: string[] = [];
    let total = "0.00";
    for (const l of e.lineas) {
      const clave = `${e.claveIdempotencia}:${l.trabajadorId}`;
      const previo = await deps.repo.buscarRegistroPorClave(tx, ctx.organizacionId, clave);
      if (previo) { ids.push(previo); continue; }
      const trab = await deps.repo.trabajadorUsuario(tx, ctx.organizacionId, l.trabajadorId);
      if (!trab.existe) throw new ErrorNoEncontrado("Trabajador");
      if (trab.usuarioId === ctx.usuarioId) {
        await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "jornada.registrar", entidad: "registro_trabajo", resultado: "denegado", despues: { motivo: "autoregistro_validado" }, ip: ctx.ip });
        throw new ErrorProhibido();
      }
      const vinc = await deps.repo.vinculacionVigente(tx, ctx.organizacionId, l.trabajadorId, e.fincaId, e.fecha);
      if (!vinc) throw new ErrorRegla("Un trabajador no está vinculado a esta finca en esa fecha; agréguelo al equipo primero", "sin_vinculacion");
      const unidadId = await deps.repo.unidadId(tx, l.unidad);
      if (!unidadId) throw new ErrorRegla("Unidad no configurada", "unidad_invalida");
      const valor = calcularValor(l.cantidad, l.valorUnitario);
      ids.push(await deps.repo.insertarRegistroValidado(tx, { organizacionId: ctx.organizacionId, fincaId: e.fincaId, loteId: e.loteId, trabajadorId: l.trabajadorId, vinculacionId: vinc.id, fecha: e.fecha, modalidad: l.unidad, labor: e.labor, cantidad: l.cantidad, unidadId, valorUnitario: l.valorUnitario, valor, clave, registradoPor: ctx.usuarioId }));
      total = sumar([total, valor]);
    }
    await registrarAuditoria(deps, ctx, tx, "jornada.registrar", "registro_trabajo", ids[0], { labor: e.labor, trabajadores: ids.length, total });
    return { ids, total };
  });
}

const esquemaValidacion = z.object({
  registroId: z.string().uuid(),
  decision: z.enum(["validar", "rechazar"]),
  cantidadValidada: z.preprocess(vacio, cantidadTxt.optional()),
  motivo: z.preprocess(vacio, z.string().trim().min(5, "Explique el motivo (mínimo 5 caracteres)").max(300).optional()),
});

/** El valor lo calcula el sistema con la tarifa vigente en la fecha de la producción; nadie lo digita. */
export async function validarTrabajo(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaValidacion, cruda, "Revise los datos de la validación");
  await autorizar(deps.auditor, ctx, "trabajo:validar", { accion: "trabajo.validar", entidad: "registro_trabajo" });
  return deps.uow.ejecutar(async (tx) => {
    const reg = await deps.repo.bloquearRegistro(tx, ctx.organizacionId, e.registroId);
    if (!reg) throw new ErrorNoEncontrado("Registro de trabajo");
    if (!ctx.fincaIds.includes(reg.fincaId)) {
      await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "trabajo.validar", entidad: "registro_trabajo", entidadId: reg.id, resultado: "denegado", despues: { motivo: "finca_no_asignada" }, ip: ctx.ip });
      throw new ErrorProhibido();
    }
    if (reg.trabajadorUsuarioId === ctx.usuarioId) {
      await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "trabajo.validar", entidad: "registro_trabajo", entidadId: reg.id, resultado: "denegado", despues: { motivo: "autovalidacion" }, ip: ctx.ip });
      throw new ErrorProhibido();
    }
    if (reg.estado !== "pendiente") throw new ErrorRegla("El registro ya fue procesado", "registro_procesado");
    if (e.decision === "rechazar") {
      if (!e.motivo) throw new ErrorValidacion("Indique el motivo del rechazo", { motivo: "Obligatorio" });
      await deps.repo.rechazarRegistro(tx, { id: reg.id, motivo: e.motivo, validadoPor: ctx.usuarioId });
      await registrarAuditoria(deps, ctx, tx, "trabajo.rechazar", "registro_trabajo", reg.id, { motivo: e.motivo });
      return { estado: "rechazado" as const };
    }
    const cantidad = e.cantidadValidada ?? reg.cantidadDeclarada;
    let factor: bigint | null = null;
    if (reg.unidadDeclarada !== reg.modalidad) {
      const unidades = await Promise.all([deps.repo.unidadId(tx, "arroba"), deps.repo.unidadId(tx, "kg")]);
      factor = aEscala(await obtenerFactorConversion({ repo: deps.configuracion }, tx, { organizacionId: ctx.organizacionId, fincaId: reg.fincaId, origenId: unidades[0]!, destinoId: unidades[1]!, fecha: reg.fecha }), 6);
    }
    const enModalidad = convertirAUnidadDeModalidad(aEscala(cantidad, ESCALA_CANTIDAD), reg.unidadDeclarada, reg.modalidad, factor);
    const validada = deEscala(enModalidad, ESCALA_CANTIDAD);
    const tarifa = await deps.configuracion.tarifaPagoVigente(tx, ctx.organizacionId, reg.fincaId, reg.trabajadorId, TIPO_TARIFA_POR_MODALIDAD[reg.modalidad], reg.fecha);
    if (!tarifa) throw new ErrorRegla("No hay una tarifa de pago vigente para esa modalidad en la fecha de la producción", "sin_tarifa_vigente");
    const valor = calcularValor(validada, tarifa.valor);
    await deps.repo.validarRegistro(tx, { id: reg.id, cantidadValidada: validada, tarifaVersionId: tarifa.tarifaVersionId, valorUnitario: tarifa.valor, valor, validadoPor: ctx.usuarioId });
    await registrarAuditoria(deps, ctx, tx, "trabajo.validar", "registro_trabajo", reg.id, { validada, valorUnitario: tarifa.valor, valor });
    return { estado: "validado" as const, valor };
  });
}

export async function listarTrabajos(deps: DependenciasTalento, ctx: ContextoUsuario, filtro: { estado?: string } = {}) {
  const propio = !ctx.permisos.has("trabajo:validar") && !ctx.permisos.has("trabajo:registrar") && ctx.permisos.has("trabajador:ver_propio");
  await autorizar(deps.auditor, ctx, propio ? "trabajador:ver_propio" : "trabajo:validar", { accion: "trabajo.listar", entidad: "registro_trabajo" });
  return deps.uow.consultar(async (tx) => {
    const trabajadorId = propio ? ((await deps.repo.trabajadorDeUsuario(tx, ctx.organizacionId, ctx.usuarioId)) ?? "00000000-0000-0000-0000-000000000000") : undefined;
    return deps.repo.listarRegistros(tx, ctx.organizacionId, ctx.fincaIds, { estado: filtro.estado, trabajadorId });
  });
}

// ───────────────────────────── Anticipos, liquidación y pagos ─────────────────────────────

const esquemaAnticipo = z.object({
  trabajadorId: z.string().uuid(),
  monto: montoTxt,
  fecha,
  nota: z.preprocess(vacio, z.string().trim().max(200).optional()),
  claveIdempotencia: z.string().min(8).max(100).optional(),
});

export async function registrarAnticipo(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaAnticipo, cruda, "Revise los datos del anticipo");
  if (Number(e.monto) <= 0) throw new ErrorValidacion("El monto debe ser mayor que cero", { monto: "Monto inválido" });
  await autorizar(deps.auditor, ctx, "anticipo:registrar", { accion: "anticipo.registrar", entidad: "anticipo" });
  return deps.uow.ejecutar(async (tx) => {
    if (e.claveIdempotencia) {
      const previo = await deps.repo.buscarAnticipoPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
      if (previo) return { id: previo, repetido: true };
    }
    if (!(await deps.repo.trabajadorUsuario(tx, ctx.organizacionId, e.trabajadorId)).existe) throw new ErrorNoEncontrado("Trabajador");
    const id = await deps.repo.insertarAnticipo(tx, { organizacionId: ctx.organizacionId, trabajadorId: e.trabajadorId, fecha: e.fecha, monto: e.monto, nota: e.nota, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId });
    await registrarAuditoria(deps, ctx, tx, "anticipo.registrar", "anticipo", id, { trabajadorId: e.trabajadorId, monto: e.monto });
    return { id, repetido: false };
  });
}

const esquemaLiquidar = z.object({
  trabajadorId: z.string().uuid(),
  desde: fecha,
  hasta: fecha,
  descontarAnticipos: z.boolean().default(false),
  claveIdempotencia: z.string().min(8).max(100).optional(),
});

/**
 * Liquida los registros VALIDADOS del período (cada uno una sola vez), descuenta anticipos si se pide y deja la
 * liquidación como hecho inmutable. Quien liquida no puede ser el propio trabajador (separación de funciones).
 */
export async function liquidarPeriodo(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaLiquidar, cruda, "Revise los datos de la liquidación");
  if (e.hasta < e.desde) throw new ErrorValidacion("El período es inválido", { hasta: "Debe ser posterior al inicio" });
  await autorizar(deps.auditor, ctx, "liquidacion:crear", { accion: "liquidacion.crear", entidad: "liquidacion" });
  return deps.uow.ejecutar(async (tx) => {
    if (e.claveIdempotencia) {
      const previa = await deps.repo.buscarLiquidacionPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
      if (previa) return { id: previa.id, neto: previa.neto, repetido: true };
    }
    const trab = await deps.repo.trabajadorUsuario(tx, ctx.organizacionId, e.trabajadorId);
    if (!trab.existe) throw new ErrorNoEncontrado("Trabajador");
    if (trab.usuarioId === ctx.usuarioId) {
      await deps.auditor.registrar({ organizacionId: ctx.organizacionId, usuarioId: ctx.usuarioId, accion: "liquidacion.crear", entidad: "liquidacion", resultado: "denegado", despues: { motivo: "autoliquidacion" }, ip: ctx.ip });
      throw new ErrorProhibido();
    }
    const registros = await deps.repo.registrosParaLiquidar(tx, ctx.organizacionId, e.trabajadorId, ctx.fincaIds, e.desde, e.hasta);
    if (registros.length === 0) throw new ErrorRegla("No hay registros validados pendientes de liquidar en ese período", "nada_por_liquidar");
    const bruto = sumar(registros.map((r) => r.valor));
    const anticipos = e.descontarAnticipos ? await deps.repo.anticiposPendientes(tx, ctx.organizacionId, e.trabajadorId) : [];
    const reparto = repartirAnticipos(anticipos, minimo(bruto, sumar(anticipos.map((a) => a.saldo))));
    const descuento = sumar(reparto.map((r) => r.monto));
    const neto = restar(bruto, descuento);
    const id = await deps.repo.insertarLiquidacion(tx, { organizacionId: ctx.organizacionId, trabajadorId: e.trabajadorId, desde: e.desde, hasta: e.hasta, totalBruto: bruto, totalAnticipos: descuento, neto, clave: e.claveIdempotencia, liquidadaPor: ctx.usuarioId });
    for (const r of registros) await deps.repo.insertarDetalleLiquidacion(tx, { liquidacionId: id, registroId: r.id, cantidad: r.cantidadValidada, valorUnitario: r.valorUnitario, valor: r.valor });
    for (const r of reparto) await deps.repo.descontarAnticipo(tx, id, r.anticipoId, r.monto);
    await registrarAuditoria(deps, ctx, tx, "liquidacion.crear", "liquidacion", id, { trabajadorId: e.trabajadorId, registros: registros.length, bruto, descuento, neto });
    return { id, neto, repetido: false };
  });
}

const esquemaPago = z.object({
  liquidacionId: z.string().uuid(),
  monto: montoTxt,
  metodo: z.string().trim().min(2, "Indique el método de pago"),
  fecha,
  claveIdempotencia: z.string().min(8).max(100).optional(),
});

export async function registrarPagoTrabajador(deps: DependenciasTalento, ctx: ContextoUsuario, cruda: unknown) {
  const e = validar(esquemaPago, cruda, "Revise los datos del pago");
  if (Number(e.monto) <= 0) throw new ErrorValidacion("El monto debe ser mayor que cero", { monto: "Monto inválido" });
  await autorizar(deps.auditor, ctx, "pago_trabajador:registrar", { accion: "pago_trabajador.registrar", entidad: "pago_trabajador" });
  return deps.uow.ejecutar(async (tx) => {
    if (e.claveIdempotencia) {
      const previo = await deps.repo.buscarPagoPorClave(tx, ctx.organizacionId, e.claveIdempotencia);
      if (previo) return { id: previo, repetido: true };
    }
    if (!(await deps.repo.metodoDePagoExiste(tx, ctx.organizacionId, e.metodo))) throw new ErrorRegla("Método de pago no configurado", "metodo_pago_invalido");
    const liq = await deps.repo.bloquearLiquidacion(tx, ctx.organizacionId, e.liquidacionId);
    if (!liq) throw new ErrorNoEncontrado("Liquidación");
    const saldo = restar(liq.neto, liq.pagado);
    if (mayorQue(e.monto, saldo)) throw new ErrorRegla(`El pago supera el saldo pendiente (${saldo})`, "pago_excede_saldo");
    const id = await deps.repo.insertarPago(tx, { organizacionId: ctx.organizacionId, liquidacionId: e.liquidacionId, monto: e.monto, metodo: e.metodo, fecha: e.fecha, clave: e.claveIdempotencia, registradoPor: ctx.usuarioId });
    await registrarAuditoria(deps, ctx, tx, "pago_trabajador.registrar", "pago_trabajador", id, { liquidacionId: e.liquidacionId, monto: e.monto });
    return { id, repetido: false };
  });
}

export async function listarLiquidaciones(deps: DependenciasTalento, ctx: ContextoUsuario) {
  const propio = !ctx.permisos.has("liquidacion:ver") && ctx.permisos.has("trabajador:ver_propio");
  await autorizar(deps.auditor, ctx, propio ? "trabajador:ver_propio" : "liquidacion:ver", { accion: "liquidacion.listar", entidad: "liquidacion" });
  return deps.uow.consultar(async (tx) => {
    const trabajadorId = propio ? ((await deps.repo.trabajadorDeUsuario(tx, ctx.organizacionId, ctx.usuarioId)) ?? "00000000-0000-0000-0000-000000000000") : undefined;
    return deps.repo.listarLiquidaciones(tx, ctx.organizacionId, ctx.fincaIds, trabajadorId);
  });
}

export type { Modalidad };
export type { FilaLiquidacion, FilaRegistroTrabajo, FilaTrabajador } from "../domain/puertos";
