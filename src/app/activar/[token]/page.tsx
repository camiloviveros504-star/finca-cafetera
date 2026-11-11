import Link from "next/link";
import { consultarInvitacion, ErrorBloqueado, servicios } from "@/composicion";
import { MarcoAcceso } from "../../_componentes/MarcoAcceso";
import { ipDeSolicitud } from "../../_servidor/sesion";
import { FormularioActivacion } from "./FormularioActivacion";

export const metadata = { title: "Activar cuenta · Gestión de Finca Cafetera", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Activar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let info: Awaited<ReturnType<typeof consultarInvitacion>>;
  try {
    info = await consultarInvitacion(servicios().invitaciones, token, await ipDeSolicitud());
  } catch (error) {
    if (!(error instanceof ErrorBloqueado)) throw error;
    return (
      <MarcoAcceso titulo="Demasiados intentos" subtitulo="Por seguridad se bloqueó temporalmente este acceso. Intente de nuevo en unos minutos.">
        <Link href="/login" className="font-semibold underline">Ir al inicio de sesión</Link>
      </MarcoAcceso>
    );
  }
  if (!info.valida) {
    return (
      <MarcoAcceso titulo="Enlace no válido" subtitulo="Este enlace no existe, ya se usó o venció.">
        <p className="text-sm text-tinta/80">Pida al administrador de su organización que le genere un enlace nuevo. Los enlaces sirven una sola vez y duran 72 horas.</p>
        <Link href="/login" className="mt-6 inline-flex min-h-11 items-center font-semibold underline">Ir al inicio de sesión</Link>
      </MarcoAcceso>
    );
  }
  const esAlta = info.tipo === "alta";
  return (
    <MarcoAcceso
      titulo={esAlta ? "Active su cuenta" : "Nueva contraseña"}
      subtitulo={esAlta ? `Hola, ${info.nombre}. Cree la contraseña con la que ingresará (${info.correo}).` : `Hola, ${info.nombre}. Elija una contraseña nueva para ${info.correo}.`}
    >
      <FormularioActivacion token={token} esAlta={esAlta} />
    </MarcoAcceso>
  );
}
