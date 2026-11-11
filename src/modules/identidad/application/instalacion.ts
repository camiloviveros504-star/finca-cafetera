/**
 * Primer arranque del sistema: crea la organización y su administrador cuando la base está vacía. Solo funciona UNA vez
 * y exige un código de instalación definido en el entorno (CODIGO_INSTALACION), para que nadie que llegue primero a una
 * instalación nueva pueda quedarse con la administración. No se siembra ningún dato de ejemplo ni valores comerciales.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Auditor, UnidadDeTrabajo } from "@/shared/aplicacion/puertos";
import { ErrorProhibido, ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
import type { RepositorioInstalacion } from "../domain/instalacion";

export interface DependenciasInstalacion {
  repo: RepositorioInstalacion;
  cifrar: (contrasena: string) => Promise<string>;
  uow: UnidadDeTrabajo;
  auditor: Auditor;
  /** Valor de CODIGO_INSTALACION; si falta o es corto, la instalación está deshabilitada. */
  codigoEsperado: string | undefined;
}

export const LARGO_MINIMO_CODIGO = 12;

export async function obtenerEstadoInstalacion(deps: DependenciasInstalacion): Promise<{ instalado: boolean; habilitada: boolean }> {
  const instalado = await deps.uow.consultar((tx) => deps.repo.hayOrganizacion(tx));
  return { instalado, habilitada: (deps.codigoEsperado?.length ?? 0) >= LARGO_MINIMO_CODIGO };
}

const esquema = z.object({
  codigo: z.string().min(1, "Ingrese el código de instalación"),
  organizacion: z.string().trim().min(3, "Indique el nombre de la organización").max(120),
  finca: z.string().trim().min(3, "Indique el nombre de la primera finca").max(120),
  nombre: z.string().trim().min(3, "Indique el nombre del administrador").max(100),
  correo: z.string().trim().toLowerCase().email("Correo inválido").max(120),
  contrasena: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres")
    .max(128)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras y números"),
  autorizaTratamiento: z.literal(true, { message: "Debe aceptar el tratamiento de sus datos personales" }),
});

const huella = (t: string) => createHash("sha256").update(t).digest();

export async function instalarSistema(deps: DependenciasInstalacion, cruda: unknown) {
  const estado = await obtenerEstadoInstalacion(deps);
  if (estado.instalado) throw new ErrorRegla("El sistema ya fue instalado", "ya_instalado");
  if (!estado.habilitada) throw new ErrorRegla(`La instalación está deshabilitada: defina CODIGO_INSTALACION (mínimo ${LARGO_MINIMO_CODIGO} caracteres) en el entorno`, "instalacion_deshabilitada");

  const r = esquema.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la instalación", campos);
  }
  const e = r.data;
  // Comparación en tiempo constante y una pausa ante un código errado para frenar la adivinación.
  if (!timingSafeEqual(huella(e.codigo), huella(deps.codigoEsperado ?? ""))) {
    await deps.auditor.registrar({ organizacionId: null, usuarioId: null, accion: "sistema.instalar", entidad: "sistema", resultado: "denegado", despues: { motivo: "codigo_incorrecto" } });
    await new Promise((ok) => setTimeout(ok, 1500));
    throw new ErrorProhibido();
  }

  const hash = await deps.cifrar(e.contrasena);
  return deps.uow.ejecutar(async (tx) => {
    const creado = await deps.repo.instalar(tx, { organizacion: e.organizacion, finca: e.finca, administrador: { nombre: e.nombre, correo: e.correo, hash } });
    if (!creado) throw new ErrorRegla("El sistema ya fue instalado", "ya_instalado");
    await deps.auditor.registrar(
      { organizacionId: creado.organizacionId, usuarioId: creado.usuarioId, accion: "sistema.instalar", entidad: "organizacion", entidadId: creado.organizacionId, resultado: "ok", despues: { finca: e.finca } },
      tx,
    );
    return creado;
  });
}
