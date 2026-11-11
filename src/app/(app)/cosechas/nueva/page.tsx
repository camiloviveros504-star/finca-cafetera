import { ErrorProhibido, obtenerOpcionesRegistro, servicios } from "@/composicion";
import { exigirContexto } from "../../../_servidor/sesion";
import { FormularioCosecha } from "./FormularioCosecha";

export const metadata = { title: "Registrar cosecha · Gestión de Finca Cafetera" };

export default async function NuevaCosecha() {
  const ctx = await exigirContexto();
  try {
    const opciones = await obtenerOpcionesRegistro(servicios().produccion, ctx);
    return (
      <section>
        <h1 className="mb-4 text-2xl font-extrabold">Registrar cosecha</h1>
        <FormularioCosecha opciones={opciones} csrfToken={ctx.csrfToken} />
      </section>
    );
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para registrar cosechas.</p>;
    throw error;
  }
}
