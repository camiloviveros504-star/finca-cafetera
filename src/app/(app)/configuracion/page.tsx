import { ErrorProhibido, listarTarifas, servicios } from "@/composicion";
import { moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { FormularioTarifa } from "./FormularioTarifa";

export const metadata = { title: "Configuración · Gestión de Finca Cafetera" };

export default async function Configuracion() {
  const ctx = await exigirContexto();
  let tarifas;
  try {
    tarifas = await listarTarifas(servicios().tarifas, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar la configuración.</p>;
    throw error;
  }
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const puedeModificar = ctx.permisos.has("tarifa:modificar");
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Tarifas y precios</h1>
      <p className="mb-4 text-sm">
        Los precios no están en el código: cada cambio crea una versión nueva con su vigencia. Las ventas ya registradas conservan el valor con el que se hicieron.
      </p>
      <ul className="space-y-4">
        {tarifas.map((t) => (
          <li key={t.tarifaId} className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-extrabold">{t.productoNombre ?? t.codigo}</h2>
              <span className="text-xs font-bold uppercase">{t.tipo.replaceAll("_", " ")}{t.esDemo ? " · DEMO" : ""}</span>
            </div>
            <p className="mt-1 text-2xl font-extrabold">
              {t.valorVigente ? moneda(t.valorVigente) : "Sin valor vigente hoy"} <span className="text-sm font-semibold">por {t.unidad}</span>
            </p>
            <p className="text-sm">Versión vigente: {t.versionVigente ?? "—"} · {t.versiones} versión(es) en total</p>
            {puedeModificar && <FormularioTarifa tarifaId={t.tarifaId} hoy={hoy} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
