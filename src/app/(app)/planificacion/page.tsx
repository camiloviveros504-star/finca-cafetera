import { ErrorProhibido, listarActividades, listarFincasYLotes, listarProyecciones, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionCerrarActividad, accionProgramarActividad, accionProyeccion } from "../sanidad/acciones";

export const metadata = { title: "Planificación agrícola · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Planificacion() {
  const ctx = await exigirContexto();
  let actividades;
  let proyecciones;
  try {
    actividades = await listarActividades(servicios().agricola, ctx);
    proyecciones = await listarProyecciones(servicios().agricola, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar la planificación.</p>;
    throw error;
  }
  const admin = ctx.permisos.has("planificacion:administrar");
  const datos = await listarFincasYLotes(servicios().fincasLotes, ctx).catch(() => ({ fincas: [], lotes: [] }));
  const fincas = datos.fincas.map((f) => ({ valor: f.id, texto: f.nombre }));
  const lotes = datos.lotes.map((l) => ({ valor: l.id, texto: `${l.fincaNombre} · ${l.codigo}` }));
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Planificación agrícola" imagen="modulo-planificacion-floracion" alt="Rama de café con flores blancas en plena floración frente a montañas cafeteras" />
      {admin && (
        <div className="grid gap-4 xl:grid-cols-2">
          <details open className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Programar actividad</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionProgramarActividad} boton="Programar" conClave campos={[
                { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas },
                { nombre: "loteId", etiqueta: "Lote (opcional)", tipo: "select", opciones: [{ valor: "", texto: "Toda la finca" }, ...lotes] },
                { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: ["floracion", "fertilizacion", "sombrio", "arvenses", "plagas", "enfermedades", "renovacion", "cosecha", "otra"].map((v) => ({ valor: v, texto: v })) },
                { nombre: "titulo", etiqueta: "Título", requerido: true },
                { nombre: "fecha", etiqueta: "Fecha programada", tipo: "date", requerido: true, valorInicial: hoy() },
              ]} />
            </div>
          </details>
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Proyección de cosecha</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionProyeccion} boton="Registrar proyección" conClave campos={[
                { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas },
                { nombre: "loteId", etiqueta: "Lote", tipo: "select", opciones: lotes },
                { nombre: "desde", etiqueta: "Desde", tipo: "date", requerido: true, valorInicial: hoy() },
                { nombre: "hasta", etiqueta: "Hasta", tipo: "date", requerido: true, valorInicial: hoy() },
                { nombre: "estimadoKg", etiqueta: "Estimado (kg)", tipo: "number", requerido: true },
                { nombre: "nota", etiqueta: "Nota" },
              ]} />
            </div>
          </details>
        </div>
      )}

      <h2 className="text-xl font-extrabold">Actividades</h2>
      <ul className="space-y-2">
        {actividades.map((a) => (
          <li key={a.id} className={`rounded-xl border-2 bg-white p-3 text-sm ${a.atrasada ? "border-cereza" : "border-cafe/20"}`}>
            <p className="font-bold">{a.fechaProgramada} · {a.tipo} · {a.titulo} · {a.fincaNombre}{a.loteCodigo ? ` · ${a.loteCodigo}` : ""}</p>
            <p>{a.estado === "programada" ? (a.atrasada ? "Atrasada" : "Programada") : `${a.estado === "completada" ? "Completada" : "Cancelada"} el ${a.fechaCierre}${a.resultado ? `: ${a.resultado}` : ""}`}</p>
            {admin && a.estado === "programada" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <FormularioGenerico compacto accion={accionCerrarActividad} boton="Completar" ocultos={{ actividadId: a.id, estado: "completada" }} campos={[{ nombre: "resultado", etiqueta: "Resultado" }]} />
                <FormularioGenerico compacto accion={accionCerrarActividad} boton="Cancelar" ocultos={{ actividadId: a.id, estado: "cancelada" }} campos={[{ nombre: "resultado", etiqueta: "Motivo" }]} />
              </div>
            )}
          </li>
        ))}
        {actividades.length === 0 && <li>Sin actividades programadas.</li>}
      </ul>

      <h2 className="text-xl font-extrabold">Proyección frente a lo cosechado</h2>
      <ul className="space-y-1 text-sm">
        {proyecciones.map((p) => (
          <li key={p.id} className="rounded-lg bg-white px-3 py-2">
            {p.fincaNombre} · {p.loteCodigo} · {p.desde} a {p.hasta}: estimado {cantidad(p.estimadoKg)} kg · cosechado {cantidad(p.realKg)} kg{p.cumplimientoPct ? ` · ${p.cumplimientoPct} %` : ""}
          </li>
        ))}
        {proyecciones.length === 0 && <li>Sin proyecciones.</li>}
      </ul>
    </section>
  );
}
