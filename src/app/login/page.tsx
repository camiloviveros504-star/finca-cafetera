import { redirect } from "next/navigation";
import { obtenerEstadoInstalacion, servicios } from "@/composicion";
import { MarcoAcceso } from "../_componentes/MarcoAcceso";
import { contextoActual } from "../_servidor/sesion";
import { FormularioLogin } from "./FormularioLogin";

export const metadata = { title: "Iniciar sesión · Gestión de Finca Cafetera" };
// Consulta la base (estado de la instalación): nunca se prerenderiza al compilar.
export const dynamic = "force-dynamic";

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ instalado?: string; cuenta?: string }> }) {
  if (await contextoActual()) redirect("/inicio");
  // Una instalación nueva (sin organización) lleva primero al asistente de instalación.
  const estado = await obtenerEstadoInstalacion(servicios().instalacion).catch(() => null);
  if (estado && !estado.instalado) redirect("/instalacion");
  const { instalado, cuenta } = await searchParams;
  return (
    <MarcoAcceso
      titulo="Iniciar sesión"
      subtitulo="Acceda con la cuenta que le asignó el administrador de su organización."
      pie={
        <ul className="space-y-2">
          <li><strong className="text-tinta">¿No tiene cuenta?</strong> Los accesos y los roles los crea el administrador; no hay registro público.</li>
          <li><strong className="text-tinta">¿Olvidó su contraseña?</strong> Pida al administrador un enlace de restablecimiento.</li>
          <li className="text-xs text-tinta/60">Por seguridad, la cuenta se bloquea temporalmente tras varios intentos fallidos y la sesión se cierra a las 8 horas.</li>
        </ul>
      }
    >
      {(cuenta === "activada" || cuenta === "restablecida") && (
        <p role="status" className="mb-5 rounded-lg border border-bosque/40 bg-bosque/10 p-3 text-sm font-semibold text-bosque">
          {cuenta === "activada" ? "Su cuenta quedó activada." : "Su contraseña fue cambiada."} Ingrese con su correo y la contraseña que acaba de crear.
        </p>
      )}
      {instalado === "1" && (
        <p role="status" className="mb-5 rounded-lg border border-bosque/40 bg-bosque/10 p-3 text-sm font-semibold text-bosque">
          Instalación completada. Ingrese con la cuenta de administrador que acaba de crear.
        </p>
      )}
      <FormularioLogin />
    </MarcoAcceso>
  );
}
