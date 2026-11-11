import { NOMBRE_ESTADO, NOMBRE_PLAGA, TIPOS_PLAGA, type CasoSanitario, type EstadoCaso } from "@/composicion";
import { accionReportarPlaga, accionSeguimientoPlaga } from "../(app)/acciones-sanidad";
import { FormularioGenerico } from "./FormularioGenerico";

const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

const COLOR_ESTADO: Record<EstadoCaso, string> = {
  detectado: "bg-alerta/10 text-alerta",
  en_tratamiento: "bg-ambar/10 text-ambar",
  mejorando: "bg-[#e8f1fb] text-[#1f5a96]",
  controlado: "bg-bosque-claro text-bosque",
};
const COLOR_SEVERIDAD = { alta: "text-alerta", media: "text-ambar", baja: "text-suave" } as const;

export function EtiquetaEstadoPlaga({ estado }: { estado: EstadoCaso }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_ESTADO[estado]}`}>{NOMBRE_ESTADO[estado]}</span>;
}

/** Resumen corto para la cabecera de un lote: la plaga abierta más grave. */
export function AvisoPlaga({ casos }: { casos: CasoSanitario[] }) {
  const abiertos = casos.filter((c) => c.estado !== "controlado");
  if (abiertos.length === 0) return null;
  const principal = abiertos[0];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_ESTADO[principal.estado]}`}>
      {principal.nombre}{abiertos.length > 1 ? ` +${abiertos.length - 1}` : ""} · {NOMBRE_ESTADO[principal.estado]}
    </span>
  );
}

/** Un caso de plaga: estado, descripción, historial y formulario para registrar el avance del tratamiento. */
export function TarjetaCaso({ caso, aplicaciones, puedeRegistrar, mostrarLote = false }: {
  caso: CasoSanitario; aplicaciones: { id: string; texto: string }[]; puedeRegistrar: boolean; mostrarLote?: boolean;
}) {
  const ultima = caso.seguimientos[0];
  return (
    <div className="rounded-lg border border-borde bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{caso.nombre}{mostrarLote ? ` · lote ${caso.loteCodigo} ${caso.loteNombre}` : ""}</p>
          <p className="text-xs text-suave">
            Severidad <span className={`font-medium ${COLOR_SEVERIDAD[caso.severidad]}`}>{caso.severidad}</span>
            {caso.afectacionPct ? ` · ${caso.afectacionPct} % afectado` : ""} · desde {caso.detectadoEn}
            {caso.estado === "controlado" ? ` · controlada el ${caso.controladoEn}` : ` · ${caso.diasAbierto} día(s) abierta`}
          </p>
        </div>
        <EtiquetaEstadoPlaga estado={caso.estado} />
      </div>
      {ultima && <p className="mt-2 text-sm text-tinta/85">{ultima.nota}</p>}

      {caso.seguimientos.length > 1 && (
        <details className="mt-2">
          <summary className="min-h-10 cursor-pointer py-2 text-xs font-medium text-suave">Historial ({caso.seguimientos.length})</summary>
          <ol className="space-y-2 border-l-2 border-borde pl-3 text-xs">
            {caso.seguimientos.map((s) => (
              <li key={s.id}>
                <p><span className="font-medium">{s.fecha}</span> · {NOMBRE_ESTADO[s.estado]} · {s.responsable}</p>
                <p className="text-tinta/80">{s.nota}{s.aplicacion ? ` — tratamiento: ${s.aplicacion}` : ""}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      {puedeRegistrar && (
        <details className="mt-1">
          <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-bosque">{caso.estado === "controlado" ? "Reapareció" : "Registrar avance"}</summary>
          <div className="mt-2">
            <FormularioGenerico accion={accionSeguimientoPlaga} boton="Guardar" ocultos={{ casoId: caso.id }} campos={[
              {
                nombre: "estado", etiqueta: "¿Cómo va?", tipo: "select", ancho: "completo",
                valorInicial: caso.estado === "detectado" ? "en_tratamiento" : caso.estado === "en_tratamiento" ? "mejorando" : caso.estado === "mejorando" ? "controlado" : "detectado",
                opciones: [
                  { valor: "en_tratamiento", texto: "En tratamiento (se está tratando)" },
                  { valor: "mejorando", texto: "Mejorando" },
                  { valor: "controlado", texto: "Controlada" },
                  { valor: "detectado", texto: "Empeoró o reapareció" },
                ],
              },
              { nombre: "nota", etiqueta: "Qué se hizo o qué se observó", tipo: "textarea", requerido: true },
              { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
              ...(aplicaciones.length > 0 ? [{ nombre: "aplicacionId", etiqueta: "Fumigación con que se trató (opcional)", tipo: "select" as const, opciones: [{ valor: "", texto: "— ninguna —" }, ...aplicaciones.map((a) => ({ valor: a.id, texto: a.texto }))] }] : []),
            ]} />
          </div>
        </details>
      )}
    </div>
  );
}

/** Formulario para reportar una plaga en un lote (fijo o a elegir). */
export function FormularioReportarPlaga({ loteId, lotes }: { loteId?: string; lotes?: { valor: string; texto: string }[] }) {
  return (
    <FormularioGenerico accion={accionReportarPlaga} boton="Reportar" conClave ocultos={loteId ? { loteId } : {}} campos={[
      ...(!loteId && lotes ? [{ nombre: "loteId", etiqueta: "Lote", tipo: "select" as const, opciones: lotes, ancho: "completo" as const }] : []),
      { nombre: "tipo", etiqueta: "Plaga o enfermedad", tipo: "select", opciones: TIPOS_PLAGA.filter((t) => t !== "otra").map((t) => ({ valor: t, texto: NOMBRE_PLAGA[t] })) },
      { nombre: "severidad", etiqueta: "Severidad", tipo: "select", valorInicial: "media", opciones: [{ valor: "baja", texto: "Baja" }, { valor: "media", texto: "Media" }, { valor: "alta", texto: "Alta" }] },
      { nombre: "esOtra", etiqueta: "No está en la lista", tipo: "checkbox" },
      { nombre: "otroNombre", etiqueta: "¿Cuál?", visibleSi: "esOtra", ancho: "completo" },
      { nombre: "descripcion", etiqueta: "Qué se encontró y cómo tratarlo", tipo: "textarea", requerido: true },
      { nombre: "afectacionPct", etiqueta: "% afectado (opcional)", tipo: "number" },
      { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
    ]} />
  );
}
