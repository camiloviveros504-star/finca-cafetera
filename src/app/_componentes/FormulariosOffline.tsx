"use client";

import { useMemo } from "react";
import { crearAccionOffline } from "../_cliente/accionOffline";
import type { TipoOperacion } from "../_cliente/colaOffline";
import { FormularioGenerico } from "./FormularioGenerico";
import { useSync } from "./ProveedorSync";

type Opcion = { valor: string; texto: string };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

/** Operaciones de este tipo guardadas en el dispositivo: pendientes, sincronizadas o rechazadas con su motivo. */
export function ColaLocal({ tipo }: { tipo: TipoOperacion }) {
  const { cola } = useSync();
  const filas = cola.filter((o) => (o.tipo ?? "cosecha") === tipo).slice(0, 8);
  if (filas.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg bg-arena p-3 text-sm" aria-label="Operaciones guardadas en este dispositivo">
      <p className="font-bold">En este dispositivo</p>
      <ul className="space-y-1">
        {filas.map((o) => (
          <li key={o.id} data-estado={o.estado}>
            <span className="font-semibold">{o.estado === "pendiente" ? "Pendiente" : o.estado === "sincronizada" ? "Sincronizada" : "Rechazada"}</span> · {o.resumen}
            {o.mensaje ? ` — ${o.mensaje}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormularioTrabajoOffline({ fincas, lotes, trabajadores }: { fincas: Opcion[]; lotes: Opcion[]; trabajadores?: Opcion[] }) {
  const accion = useMemo(() => crearAccionOffline("trabajo", (d) => `Trabajo ${d.fecha}: ${d.cantidad} ${d.unidad}`), []);
  return (
    <>
      <FormularioGenerico
        accion={accion}
        boton="Guardar registro"
        conClave
        campos={[
          ...(trabajadores ? [{ nombre: "trabajadorId", etiqueta: "Trabajador", tipo: "select" as const, opciones: trabajadores }] : []),
          { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas },
          { nombre: "loteId", etiqueta: "Lote (opcional)", tipo: "select", opciones: [{ valor: "", texto: "Sin lote" }, ...lotes] },
          { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
          { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number", requerido: true },
          { nombre: "unidad", etiqueta: "Unidad", tipo: "select", opciones: [{ valor: "kg", texto: "Kilogramos" }, { valor: "arroba", texto: "Arrobas" }, { valor: "jornada", texto: "Jornadas" }, { valor: "actividad", texto: "Actividades" }] },
          { nombre: "actividad", etiqueta: "Actividad (si se paga por actividad)" },
        ]}
      />
      <ColaLocal tipo="trabajo" />
    </>
  );
}

export function FormularioInspeccionOffline({ fincas, lotes }: { fincas: Opcion[]; lotes: Opcion[] }) {
  const accion = useMemo(() => crearAccionOffline("inspeccion", (d) => `Inspección ${d.fecha}: ${d.tipo} (${d.severidad})`), []);
  return (
    <>
      <FormularioGenerico
        accion={accion}
        boton="Guardar inspección"
        conClave
        campos={[
          { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas },
          { nombre: "loteId", etiqueta: "Lote (opcional)", tipo: "select", opciones: [{ valor: "", texto: "Toda la finca" }, ...lotes] },
          { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
          { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: ["broca", "roya", "plaga", "enfermedad", "general"].map((v) => ({ valor: v, texto: v })) },
          { nombre: "severidad", etiqueta: "Severidad", tipo: "select", opciones: ["ninguna", "baja", "media", "alta"].map((v) => ({ valor: v, texto: v })) },
          { nombre: "infestacionPct", etiqueta: "Infestación (%)", tipo: "number" },
          { nombre: "hallazgos", etiqueta: "Hallazgos", tipo: "textarea", requerido: true },
          { nombre: "acciones", etiqueta: "Acciones recomendadas", tipo: "textarea" },
        ]}
      />
      <ColaLocal tipo="inspeccion" />
    </>
  );
}
