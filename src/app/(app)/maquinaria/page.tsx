import { ErrorProhibido, listarEquipos, listarFincasYLotes, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { cantidad, moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionCrearEquipo, accionMantenimiento, accionUsoEquipo } from "../sanidad/acciones";

export const metadata = { title: "Maquinaria · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Maquinaria() {
  const ctx = await exigirContexto();
  let datos;
  try {
    datos = await listarEquipos(servicios().agricola, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar maquinaria.</p>;
    throw error;
  }
  const administra = ctx.permisos.has("equipo:administrar");
  const usa = ctx.permisos.has("equipo:registrar_uso");
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const opcionesEquipo = datos.equipos.filter((e) => e.estado === "activo").map((e) => ({ valor: e.id, texto: `${e.codigo} · ${e.nombre}` }));
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Maquinaria y herramientas" detalle="Equipos, uso, combustible y mantenimientos. El costo de mantenimiento se carga como gasto." />
      <div className="grid gap-4 xl:grid-cols-3">
        {administra && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo equipo</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionCrearEquipo} boton="Crear equipo" campos={[
                { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })) },
                { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: ["maquinaria", "herramienta", "vehiculo"].map((v) => ({ valor: v, texto: v })) },
                { nombre: "codigo", etiqueta: "Código", requerido: true }, { nombre: "nombre", etiqueta: "Nombre", requerido: true },
                { nombre: "intervaloDias", etiqueta: "Mantenimiento cada (días)", tipo: "number", inputMode: "numeric" },
              ]} />
            </div>
          </details>
        )}
        {usa && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Registrar uso</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionUsoEquipo} boton="Registrar uso" conClave campos={[
                { nombre: "equipoId", etiqueta: "Equipo", tipo: "select", opciones: opcionesEquipo },
                { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                { nombre: "horas", etiqueta: "Horas", tipo: "number", requerido: true }, { nombre: "combustible", etiqueta: "Combustible (litros)", tipo: "number" },
              ]} />
            </div>
          </details>
        )}
        {administra && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Registrar mantenimiento</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionMantenimiento} boton="Registrar mantenimiento" conClave campos={[
                { nombre: "equipoId", etiqueta: "Equipo", tipo: "select", opciones: datos.equipos.map((e) => ({ valor: e.id, texto: `${e.codigo} · ${e.nombre}` })) },
                { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: ["preventivo", "correctivo", "calibracion"].map((v) => ({ valor: v, texto: v })) },
                { nombre: "costo", etiqueta: "Costo (COP)", tipo: "number" }, { nombre: "proximoEn", etiqueta: "Próximo mantenimiento", tipo: "date" },
                { nombre: "descripcion", etiqueta: "Trabajo realizado", tipo: "textarea", requerido: true },
              ]} />
            </div>
          </details>
        )}
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {datos.equipos.map((e) => (
          <li key={e.id} className={`rounded-xl border-2 bg-white p-3 text-sm ${e.mantenimientoVencido ? "border-cereza" : "border-cafe/20"}`}>
            <p className="font-extrabold">{e.codigo} · {e.nombre} <span className="font-normal">({e.tipo} · {e.fincaNombre})</span></p>
            <p>Estado: {e.estado.replace("_", " ")} · {cantidad(e.horasUso)} h de uso · {cantidad(e.combustibleLitros)} L</p>
            <p>Mantenimientos: {moneda(e.costoMantenimiento)} · último {e.ultimoMantenimiento ?? "—"} · próximo {e.proximoMantenimiento ?? "—"}{e.mantenimientoVencido ? " · VENCIDO" : ""}</p>
          </li>
        ))}
        {datos.equipos.length === 0 && <li>No hay equipos registrados.</li>}
      </ul>
      <h2 className="text-xl font-extrabold">Historial de mantenimientos</h2>
      <ul className="space-y-1 text-sm">
        {datos.mantenimientos.map((m) => <li key={m.id} className="rounded-lg bg-white px-3 py-2">{m.fecha} · {m.equipo} · {m.tipo} · {m.descripcion} · <strong>{moneda(m.costo)}</strong>{m.conGasto ? " · cargado a gastos" : ""}</li>)}
      </ul>
    </section>
  );
}
