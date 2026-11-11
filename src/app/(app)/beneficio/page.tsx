import { ErrorProhibido, listarProcesos, listarRegistrosProceso, obtenerOpcionesRegistro, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionCrearProceso, accionEjecutarEtapa } from "./acciones";

export const metadata = { title: "Beneficio y poscosecha · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Beneficio() {
  const ctx = await exigirContexto();
  let procesos;
  let registros;
  try {
    procesos = await listarProcesos(servicios().beneficio, ctx);
    registros = await listarRegistrosProceso(servicios().beneficio, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar el beneficio.</p>;
    throw error;
  }
  const registra = ctx.permisos.has("proceso:registrar");
  const administra = ctx.permisos.has("proceso:administrar");
  const o = registra || administra ? await obtenerOpcionesRegistro(servicios().produccion, ctx).catch(() => null) : null;
  const etapas = procesos.flatMap((p) => p.etapas.map((e) => ({ valor: e.id, texto: `${p.nombre} · ${e.orden}. ${e.nombre} (${e.productoEntradaNombre} → ${e.productoSalidaNombre})` })));
  const productos = (o?.productos ?? []).map((x) => ({ valor: x.id, texto: x.nombre }));
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Beneficio y poscosecha" imagen="hero-4-beneficio-lavado" alt="Tanque de lavado con café en pergamino recién despulpado" />
      <p className="text-sm">Cada etapa registra entrada, salida, pérdida, responsable, fecha y lote de origen. Los flujos son configurables: no todo el café pasa por las mismas etapas. Los porcentajes de merma de los flujos DEMO son valores ilustrativos.</p>

      {registra && o && (
        <details open className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Registrar una etapa</summary>
          <div className="mt-3">
            <FormularioGenerico
              accion={accionEjecutarEtapa}
              boton="Registrar etapa"
              conClave
              campos={[
                { nombre: "etapaId", etiqueta: "Proceso y etapa", tipo: "select", opciones: etapas },
                { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: o.fincas.map((f) => ({ valor: f.id, texto: f.nombre })) },
                { nombre: "bodegaId", etiqueta: "Bodega", tipo: "select", opciones: o.bodegas.map((b) => ({ valor: b.id, texto: b.nombre })) },
                { nombre: "loteId", etiqueta: "Lote de origen", tipo: "select", opciones: o.lotes.map((l) => ({ valor: l.id, texto: `${l.codigo} · ${l.nombre}` })) },
                { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                { nombre: "cantidadEntrada", etiqueta: "Entrada (kg)", tipo: "number", requerido: true },
                { nombre: "cantidadSalida", etiqueta: "Salida (kg)", tipo: "number", requerido: true },
                { nombre: "justificacion", etiqueta: "Justificación (si la merma supera la esperada)", tipo: "textarea" },
              ]}
            />
          </div>
        </details>
      )}

      {administra && o && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo flujo de proceso (hasta 3 etapas)</summary>
          <div className="mt-3">
            <FormularioGenerico
              accion={accionCrearProceso}
              boton="Crear flujo"
              campos={[
                { nombre: "codigo", etiqueta: "Código del flujo", requerido: true, placeholder: "cafe_honey" },
                { nombre: "nombre", etiqueta: "Nombre", requerido: true },
                ...[1, 2, 3].flatMap((n) => [
                  { nombre: `codigo${n}`, etiqueta: `Etapa ${n}: código`, requerido: n === 1 },
                  { nombre: `nombre${n}`, etiqueta: `Etapa ${n}: nombre`, requerido: n === 1 },
                  { nombre: `entrada${n}`, etiqueta: `Etapa ${n}: producto de entrada`, tipo: "select" as const, opciones: productos },
                  { nombre: `salida${n}`, etiqueta: `Etapa ${n}: producto de salida`, tipo: "select" as const, opciones: productos },
                  { nombre: `merma${n}`, etiqueta: `Etapa ${n}: merma esperada (%)`, tipo: "number" as const },
                ]),
              ]}
            />
          </div>
        </details>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {procesos.map((p) => (
          <div key={p.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
            <p className="font-extrabold">{p.nombre}{p.esDemo ? " · DEMO" : ""}</p>
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {p.etapas.map((e) => (
                <li key={e.id}>{e.nombre}: {e.productoEntradaNombre} → {e.productoSalidaNombre}{e.mermaEsperadaPct ? ` (merma esperada ${e.mermaEsperadaPct} %)` : ""}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-extrabold">Historial de etapas</h2>
      <ul className="space-y-2">
        {registros.map((r) => (
          <li key={r.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3 text-sm">
            <p className="font-bold">{r.fecha} · {r.procesoNombre} · {r.etapaNombre} · {r.fincaNombre}</p>
            <p>Entrada {cantidad(r.entradaTotal)} kg → salida {cantidad(r.salidaTotal)} kg · pérdida {cantidad(r.perdidaTotal)} kg ({r.mermaPct} %){r.mermaExcede ? " · supera la merma esperada" : ""} · {r.responsable}</p>
            {r.justificacion && <p>Justificación: {r.justificacion}</p>}
          </li>
        ))}
        {registros.length === 0 && <li>Aún no hay etapas registradas.</li>}
      </ul>
    </section>
  );
}
