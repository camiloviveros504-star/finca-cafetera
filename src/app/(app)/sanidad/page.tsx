import { ErrorProhibido, listarAgroquimicos, listarAmbientales, listarFincasYLotes, listarInspecciones, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { FormularioInspeccionOffline } from "../../_componentes/FormulariosOffline";
import { accionAmbiental, accionAplicacion, accionCrearAgroquimico, accionEntradaAgroquimico } from "./acciones";

export const metadata = { title: "Sanidad e inspecciones · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const Caja = ({ titulo, abierto, children }: { titulo: string; abierto?: boolean; children: React.ReactNode }) => (
  <details open={abierto} className="rounded-xl border-2 border-tinta/20 bg-white p-4">
    <summary className="min-h-11 cursor-pointer text-lg font-extrabold">{titulo}</summary>
    <div className="mt-3">{children}</div>
  </details>
);

export default async function Sanidad() {
  const ctx = await exigirContexto();
  const p = (x: string) => ctx.permisos.has(x);
  const inspecciones = p("inspeccion:ver") ? await listarInspecciones(servicios().agricola, ctx).catch((e) => { if (e instanceof ErrorProhibido) return []; throw e; }) : [];
  const ambientales = p("inspeccion:ver") ? await listarAmbientales(servicios().agricola, ctx).catch(() => []) : [];
  const agro = p("agroquimico:ver") ? await listarAgroquimicos(servicios().agricola, ctx).catch(() => null) : null;
  if (!p("inspeccion:ver") && !p("agroquimico:ver")) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar sanidad.</p>;
  const datos = await listarFincasYLotes(servicios().fincasLotes, ctx).catch(() => ({ fincas: [], lotes: [] }));
  const fincas = datos.fincas.map((f) => ({ valor: f.id, texto: f.nombre }));
  const lotes = datos.lotes.map((l) => ({ valor: l.id, texto: `${l.fincaNombre} · ${l.codigo}` }));
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Sanidad e inspecciones" imagen="modulo-sanidad-inspeccion" alt="Agrónomo revisando con lupa las cerezas de una rama de café y tomando notas" />
      <div className="grid gap-4 xl:grid-cols-2">
        {p("inspeccion:registrar") && (
          <Caja titulo="Registrar inspección (funciona sin conexión)" abierto>
            <FormularioInspeccionOffline fincas={fincas} lotes={lotes} />
          </Caja>
        )}
        {p("inspeccion:registrar") && (
          <Caja titulo="Registro ambiental (envases, residuos, agua, erosión)">
            <FormularioGenerico accion={accionAmbiental} boton="Registrar" conClave campos={[
              { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas },
              { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
              { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: ["envases", "residuos", "agua", "erosion", "otro"].map((v) => ({ valor: v, texto: v })) },
              { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number" },
              { nombre: "unidad", etiqueta: "Unidad" },
              { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea", requerido: true },
            ]} />
          </Caja>
        )}
        {p("agroquimico:administrar") && agro && (
          <Caja titulo="Agroquímicos: nuevo producto y entrada de existencias">
            <div className="space-y-4">
              <FormularioGenerico accion={accionCrearAgroquimico} boton="Crear producto" campos={[{ nombre: "nombre", etiqueta: "Nombre", requerido: true }, { nombre: "unidad", etiqueta: "Unidad", requerido: true, placeholder: "litro" }, { nombre: "carenciaDias", etiqueta: "Carencia (días, dato del producto)", tipo: "number", inputMode: "numeric" }]} />
              <FormularioGenerico accion={accionEntradaAgroquimico} boton="Registrar entrada" campos={[
                { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas },
                { nombre: "agroquimicoId", etiqueta: "Producto", tipo: "select", opciones: agro.catalogo.map((a) => ({ valor: a.id, texto: a.nombre })) },
                { nombre: "loteComercial", etiqueta: "Lote del proveedor", requerido: true },
                { nombre: "vencimiento", etiqueta: "Vencimiento", tipo: "date", requerido: true },
                { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number", requerido: true },
              ]} />
            </div>
          </Caja>
        )}
        {p("aplicacion:registrar") && agro && (
          <Caja titulo="Registrar aplicación">
            <FormularioGenerico accion={accionAplicacion} boton="Registrar aplicación" conClave campos={[
              { nombre: "stockId", etiqueta: "Existencia", tipo: "select", opciones: agro.stock.filter((s) => !s.vencido).map((s) => ({ valor: s.id, texto: `${s.nombre} · ${s.loteComercial} (${cantidad(s.cantidad)} ${s.unidad})` })) },
              { nombre: "loteId", etiqueta: "Lote", tipo: "select", opciones: lotes },
              { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
              { nombre: "dosis", etiqueta: "Dosis", tipo: "number", requerido: true },
              { nombre: "unidadDosis", etiqueta: "Unidad de la dosis", requerido: true, placeholder: "litro/ha" },
              { nombre: "cantidadTotal", etiqueta: "Cantidad total usada", tipo: "number", requerido: true },
            ]} />
          </Caja>
        )}
      </div>

      {agro && (
        <>
          <h2 className="text-xl font-extrabold">Existencias de agroquímicos</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {agro.stock.map((s) => (
              <li key={s.id} className={`rounded-xl border-2 bg-white p-3 text-sm ${s.vencido ? "border-alerta" : s.porVencer ? "border-ambar" : "border-tinta/20"}`}>
                <strong>{s.nombre}</strong> · lote {s.loteComercial} · {s.fincaNombre}<br />
                {cantidad(s.cantidad)} {s.unidad} · vence {s.vencimiento}{s.vencido ? " · VENCIDO" : s.porVencer ? " · vence en menos de 30 días" : ""}
              </li>
            ))}
            {agro.stock.length === 0 && <li>Sin existencias registradas.</li>}
          </ul>
          <h2 className="text-xl font-extrabold">Aplicaciones</h2>
          <ul className="space-y-1 text-sm">
            {agro.aplicaciones.map((a) => <li key={a.id} className="rounded-lg bg-white px-3 py-2">{a.fecha} · {a.fincaNombre} · {a.loteCodigo} · {a.agroquimico} ({a.loteComercial}) · dosis {cantidad(a.dosis)} {a.unidadDosis} · total {cantidad(a.cantidadTotal)} · {a.responsable}{a.fechaReingreso ? ` · cosecha segura desde ${a.fechaReingreso}` : ""}</li>)}
          </ul>
        </>
      )}

      <h2 className="text-xl font-extrabold">Inspecciones</h2>
      <ul className="space-y-2 text-sm">
        {inspecciones.map((i) => (
          <li key={i.id} className="rounded-xl border-2 border-tinta/20 bg-white p-3">
            <p className="font-bold">{i.fecha} · {i.tipo} · severidad {i.severidad}{i.infestacionPct ? ` · ${i.infestacionPct} %` : ""} · {i.fincaNombre}{i.loteCodigo ? ` · ${i.loteCodigo}` : ""}</p>
            <p>{i.hallazgos}{i.acciones ? ` — Acciones: ${i.acciones}` : ""} <span className="opacity-70">({i.inspector})</span></p>
          </li>
        ))}
        {inspecciones.length === 0 && <li>Aún no hay inspecciones.</li>}
      </ul>
      {ambientales.length > 0 && (
        <>
          <h2 className="text-xl font-extrabold">Registros ambientales</h2>
          <ul className="space-y-1 text-sm">{ambientales.map((a) => <li key={a.id} className="rounded-lg bg-white px-3 py-2">{a.fecha} · {a.tipo} · {a.descripcion}{a.cantidad ? ` · ${cantidad(a.cantidad)} ${a.unidad ?? ""}` : ""} · {a.fincaNombre}</li>)}</ul>
        </>
      )}
    </section>
  );
}
