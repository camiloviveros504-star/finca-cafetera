import { ErrorProhibido, obtenerOpcionesVenta, servicios } from "@/composicion";
import { exigirContexto } from "../../../_servidor/sesion";
import { FormularioVenta } from "./FormularioVenta";

export const metadata = { title: "Registrar venta · Gestión de Finca Cafetera" };

export default async function NuevaVenta() {
  const ctx = await exigirContexto();
  try {
    const opciones = await obtenerOpcionesVenta(servicios().comercial, ctx);
    return (
      <section>
        <h1 className="mb-4 text-2xl font-extrabold">Registrar venta</h1>
        <FormularioVenta {...opciones} />
      </section>
    );
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para registrar ventas.</p>;
    throw error;
  }
}
