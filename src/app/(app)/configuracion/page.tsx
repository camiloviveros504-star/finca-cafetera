import { ErrorProhibido, listarFincasYLotes, listarTarifas, listarTrabajadores, servicios } from "@/composicion";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { accionCrearTarifa } from "./acciones";
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
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar la configuración.</p>;
    throw error;
  }
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const puedeModificar = ctx.permisos.has("tarifa:modificar");
  const fincas = puedeModificar ? await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []) : [];
  const trabajadores = puedeModificar ? await listarTrabajadores(servicios().talento, ctx).catch(() => []) : [];
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Tarifas y precios</h1>
      <p className="mb-4 text-sm">
        Los precios no están en el código: cada cambio crea una versión nueva con su vigencia. Las ventas ya registradas conservan el valor con el que se hicieron.
      </p>
      {puedeModificar && (
        <details className="mb-4 rounded-xl border-2 border-tinta/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nueva tarifa (precio, compra o pago)</summary>
          <div className="mt-3">
            <FormularioGenerico
              accion={accionCrearTarifa}
              boton="Crear tarifa"
              campos={[
                { nombre: "codigo", etiqueta: "Código", requerido: true, placeholder: "pago_kg_finca" },
                { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: [["pago_kg", "Pago por kg"], ["pago_arroba", "Pago por arroba"], ["pago_jornada", "Pago por jornada"], ["pago_actividad", "Pago por actividad"], ["precio_compra", "Precio de compra"], ["especial", "Tarifa especial"]].map(([valor, texto]) => ({ valor, texto })) },
                { nombre: "unidadCodigo", etiqueta: "Unidad", tipo: "select", opciones: ["kg", "arroba", "jornada", "actividad", "saco", "carga"].map((v) => ({ valor: v, texto: v })) },
                { nombre: "fincaId", etiqueta: "Finca (opcional)", tipo: "select", opciones: [{ valor: "", texto: "General" }, ...fincas.map((f) => ({ valor: f.id, texto: f.nombre }))] },
                { nombre: "trabajadorId", etiqueta: "Trabajador (opcional)", tipo: "select", opciones: [{ valor: "", texto: "Todos" }, ...trabajadores.map((w) => ({ valor: w.id, texto: w.nombre }))] },
                { nombre: "valor", etiqueta: "Valor (COP)", tipo: "number", requerido: true },
                { nombre: "desde", etiqueta: "Vigente desde", tipo: "date", requerido: true, valorInicial: hoy },
              ]}
            />
          </div>
        </details>
      )}
      <ul className="space-y-4">
        {tarifas.map((t) => (
          <li key={t.tarifaId} className="rounded-xl border-2 border-tinta/20 bg-white p-4">
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
