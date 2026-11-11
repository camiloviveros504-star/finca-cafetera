import { redirect } from "next/navigation";
import { LARGO_MINIMO_CODIGO, obtenerEstadoInstalacion, servicios } from "@/composicion";
import { FormularioGenerico } from "../_componentes/FormularioGenerico";
import { MarcoAcceso } from "../_componentes/MarcoAcceso";
import { accionInstalar } from "./acciones";

export const metadata = { title: "Instalación · Gestión de Finca Cafetera" };

export default async function Instalacion() {
  const estado = await obtenerEstadoInstalacion(servicios().instalacion);
  if (estado.instalado) redirect("/login");
  return (
    <MarcoAcceso titulo="Instalación del sistema" subtitulo="Cree su organización y la cuenta de administrador. Este paso solo se hace una vez.">
      {!estado.habilitada ? (
        <p role="alert" className="rounded-lg border-2 border-alerta bg-white p-4 text-sm">
          La instalación está deshabilitada. Defina la variable de entorno <code className="font-mono">CODIGO_INSTALACION</code> (mínimo {LARGO_MINIMO_CODIGO} caracteres) en el servidor y
          reinicie la aplicación.
        </p>
      ) : (
        <FormularioGenerico
          accion={accionInstalar}
          boton="Instalar el sistema"
          campos={[
            { nombre: "codigo", etiqueta: "Código de instalación", tipo: "password", requerido: true },
            { nombre: "organizacion", etiqueta: "Nombre de la organización", requerido: true },
            { nombre: "finca", etiqueta: "Nombre de la primera finca", requerido: true },
            { nombre: "nombre", etiqueta: "Su nombre completo", requerido: true },
            { nombre: "correo", etiqueta: "Su correo", requerido: true },
            { nombre: "contrasena", etiqueta: "Contraseña (mínimo 10 caracteres, letras y números)", tipo: "password", requerido: true },
            { nombre: "autoriza", etiqueta: "Acepto el tratamiento de mis datos personales según la política de privacidad", tipo: "checkbox", requerido: true },
          ]}
        />
      )}
    </MarcoAcceso>
  );
}
