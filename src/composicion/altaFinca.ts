/**
 * Alta de una finca en un solo paso, pensada para quien administra la plataforma: crea la finca (con su bodega principal) y
 * la asigna a un propietario que ya existe (un dueño puede tener varias fincas) o a uno nuevo, al que deja listo con su enlace
 * de activación. Antes de crear nada se comprueba que el correo del propietario sea
 * válido y no esté en uso, para no dejar fincas sin dueño por un error de digitación. Si aun así falla la invitación, la
 * finca queda creada y se puede agregar el propietario después desde la propia finca.
 */
import { z } from "zod";
import { crearFinca, type DependenciasFincasLotes } from "@/modules/produccion/application/fincasLotes";
import { invitarUsuario, type DependenciasInvitaciones } from "@/modules/identidad/application/invitaciones";
import { agregarFincaAPropietario, correoEnUso, listarUsuarios, type DependenciasUsuarios } from "@/modules/identidad/application/usuarios";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";

type ServiciosAlta = { fincasLotes: DependenciasFincasLotes; invitaciones: DependenciasInvitaciones; usuarios: DependenciasUsuarios };

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const esquema = z.object({
  nombre: z.string().trim().min(3, "Indique el nombre de la finca").max(120),
  ubicacion: z.preprocess(vacio, z.string().trim().max(200).optional()),
  areaHa: z.preprocess(vacio, z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, "Área inválida").optional()),
  /** Propietario que ya existe (otra finca suya). Si se indica, no se crea una cuenta nueva. */
  propietarioId: z.preprocess(vacio, z.string().uuid().optional()),
  propietarioNombre: z.preprocess(vacio, z.string().trim().min(3, "Indique el nombre del propietario").max(100).optional()),
  propietarioCorreo: z.preprocess(vacio, z.string().trim().toLowerCase().email("Correo inválido").max(120).optional()),
});

export async function altaDeFinca(s: ServiciosAlta, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquema.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la finca", campos);
  }
  const e = r.data;
  if (e.propietarioId) {
    const { usuarios } = await listarUsuarios(s.usuarios, ctx);
    const dueno = usuarios.find((u) => u.id === e.propietarioId);
    if (!dueno || !dueno.roles.includes("propietario")) throw new ErrorRegla("Elija un propietario existente", "no_es_propietario");
    const { id: fincaId } = await crearFinca(s.fincasLotes, ctx, { nombre: e.nombre, ubicacion: e.ubicacion, areaHa: e.areaHa });
    await agregarFincaAPropietario(s.usuarios, ctx, { usuarioId: dueno.id, fincaId });
    return { fincaId, invitacion: null, propietario: dueno.nombre };
  }
  if (Boolean(e.propietarioNombre) !== Boolean(e.propietarioCorreo)) {
    throw new ErrorValidacion("Para asignar el propietario escriba su nombre y su correo", { propietarioCorreo: "Falta el nombre o el correo" });
  }
  if (e.propietarioCorreo) {
    if (await correoEnUso(s.usuarios, ctx, e.propietarioCorreo)) {
      throw new ErrorRegla("Ya existe una cuenta con ese correo; si es un propietario, elíjalo como propietario existente", "usuario_duplicado");
    }
  }
  const { id: fincaId } = await crearFinca(s.fincasLotes, ctx, { nombre: e.nombre, ubicacion: e.ubicacion, areaHa: e.areaHa });
  if (!e.propietarioCorreo || !e.propietarioNombre) return { fincaId, invitacion: null, propietario: null };
  const inv = await invitarUsuario(s.invitaciones, ctx, { correo: e.propietarioCorreo, nombre: e.propietarioNombre, roles: ["propietario"], fincaIds: [fincaId] });
  return { fincaId, invitacion: { token: inv.token, expiraEn: inv.expiraEn, usuarioId: inv.usuarioId }, propietario: e.propietarioNombre };
}
