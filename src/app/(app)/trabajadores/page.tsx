import Link from "next/link";
import { ErrorProhibido, listarFincasYLotes, listarTrabajadores, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionAnticipo, accionCrearTrabajador, accionVincular } from "./acciones";

export const metadata = { title: "Trabajadores · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Trabajadores() {
  const ctx = await exigirContexto();
  let lista;
  try {
    lista = await listarTrabajadores(servicios().talento, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar trabajadores.</p>;
    throw error;
  }
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const administra = ctx.permisos.has("trabajador:administrar");
  const opcionesTrabajador = lista.map((w) => ({ valor: w.id, texto: w.nombre }));
  const propio = !ctx.permisos.has("trabajador:ver");
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo={propio ? "Mis datos y acumulados" : "Trabajadores"} imagen="hero-3-caficultores" alt="Grupo de caficultores recolectando café en una ladera" />
      <p className="text-sm">Remuneración por producción o jornada. Este sistema no es software de nómina legal: no calcula prestaciones, seguridad social ni retenciones.</p>

      <div className="grid gap-4 xl:grid-cols-3">
        {administra && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo trabajador</summary>
            <div className="mt-3">
              <FormularioGenerico
                accion={accionCrearTrabajador}
                boton="Crear trabajador"
                campos={[
                  { nombre: "tipoDocumento", etiqueta: "Tipo de documento", tipo: "select", opciones: ["CC", "CE", "TI", "PEP", "PPT", "otro"].map((v) => ({ valor: v, texto: v })) },
                  { nombre: "numeroDocumento", etiqueta: "Número de documento", requerido: true },
                  { nombre: "nombres", etiqueta: "Nombres", requerido: true },
                  { nombre: "apellidos", etiqueta: "Apellidos", requerido: true },
                  { nombre: "telefono", etiqueta: "Teléfono" },
                  { nombre: "autorizaTratamiento", etiqueta: "El trabajador autorizó el tratamiento de sus datos personales (Ley 1581)", tipo: "checkbox", requerido: true },
                ]}
              />
            </div>
          </details>
        )}
        {administra && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Vincular a una finca</summary>
            <div className="mt-3">
              <FormularioGenerico
                accion={accionVincular}
                boton="Crear vinculación"
                campos={[
                  { nombre: "trabajadorId", etiqueta: "Trabajador", tipo: "select", opciones: opcionesTrabajador },
                  { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })) },
                  { nombre: "modalidad", etiqueta: "Modalidad de pago", tipo: "select", opciones: [{ valor: "kg", texto: "Por kilogramo" }, { valor: "arroba", texto: "Por arroba" }, { valor: "jornada", texto: "Por jornada" }, { valor: "actividad", texto: "Por actividad" }] },
                  { nombre: "cargo", etiqueta: "Cargo" },
                  { nombre: "desde", etiqueta: "Desde", tipo: "date", requerido: true, valorInicial: hoy() },
                  { nombre: "hasta", etiqueta: "Hasta (opcional)", tipo: "date" },
                ]}
              />
            </div>
          </details>
        )}
        {ctx.permisos.has("anticipo:registrar") && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Registrar anticipo</summary>
            <div className="mt-3">
              <FormularioGenerico
                accion={accionAnticipo}
                boton="Registrar anticipo"
                conClave
                campos={[
                  { nombre: "trabajadorId", etiqueta: "Trabajador", tipo: "select", opciones: opcionesTrabajador },
                  { nombre: "monto", etiqueta: "Monto (COP)", tipo: "number", requerido: true },
                  { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                  { nombre: "nota", etiqueta: "Nota" },
                ]}
              />
            </div>
          </details>
        )}
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {lista.map((w) => (
          <li key={w.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
            <p className="font-extrabold">{w.nombre} <span className="text-sm font-normal">· {w.documento}</span></p>
            {ctx.permisos.has("datos_personales:gestionar") && <Link href={`/trabajadores/${w.id}`} className="inline-flex min-h-11 items-center text-sm font-bold text-cafetal underline">Datos personales (Ley 1581)</Link>}
            <p className="text-sm">{w.vinculaciones.length === 0 ? "Sin vinculación" : w.vinculaciones.map((v) => `${v.fincaNombre} (${v.modalidad})`).join(" · ")}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt>Pendientes de validar</dt><dd className="text-right font-bold">{w.registrosPendientes}</dd>
              <dt>Validado (valor)</dt><dd className="text-right font-bold">{moneda(w.validadoValor)}</dd>
              <dt>Liquidado neto</dt><dd className="text-right font-bold">{moneda(w.liquidadoNeto)}</dd>
              <dt>Pagado</dt><dd className="text-right font-bold">{moneda(w.pagado)}</dd>
              <dt>Saldo pendiente</dt><dd className="text-right font-bold text-cereza">{moneda(w.saldoPendiente)}</dd>
              <dt>Anticipos por descontar</dt><dd className="text-right font-bold">{moneda(w.anticiposPendientes)}</dd>
            </dl>
          </li>
        ))}
        {lista.length === 0 && <li>No hay trabajadores registrados.</li>}
      </ul>
    </section>
  );
}
