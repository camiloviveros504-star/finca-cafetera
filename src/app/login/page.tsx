import { redirect } from "next/navigation";
import { obtenerEstadoInstalacion, servicios } from "@/composicion";
import { MarcoAcceso } from "../_componentes/MarcoAcceso";
import { contextoActual } from "../_servidor/sesion";
import { FormularioLogin } from "./FormularioLogin";

export const metadata = { title: "Iniciar sesión · Gestión de Finca Cafetera" };
// Consulta la base (estado de la instalación): nunca se prerenderiza al compilar.
export const dynamic = "force-dynamic";

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ instalado?: string }> }) {
  if (await contextoActual()) redirect("/inicio");
  // Una instalación nueva (sin organización) lleva primero al asistente de instalación.
  const estado = await obtenerEstadoInstalacion(servicios().instalacion).catch(() => null);
  if (estado && !estado.instalado) redirect("/instalacion");
  const { instalado } = await searchParams;
  return (
    <MarcoAcceso titulo="Bienvenido" subtitulo="Ingrese con su cuenta para continuar.">
      {instalado === "1" && (
        <p role="status" className="mb-5 rounded-lg border border-bosque/40 bg-bosque/10 p-3 text-sm font-semibold text-bosque">
          Instalación completada. Ingrese con la cuenta de administrador que acaba de crear.
        </p>
      )}
      <FormularioLogin />
    </MarcoAcceso>
  );
}
