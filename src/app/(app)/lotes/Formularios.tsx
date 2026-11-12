"use client";

import { useActionState } from "react";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { accionCrearLote, accionEliminarLote, accionEventoLote } from "./acciones";


function Mensaje({ estado }: { estado: { ok?: boolean; error?: string; mensaje?: string; campos?: Record<string, string> } }) {
  if (estado.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-alerta sm:col-span-2">
        {estado.error}
        {estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
      </p>
    );
  }
  return estado.ok ? <p role="status" className="text-sm font-semibold text-bosque sm:col-span-2">{estado.mensaje}</p> : null;
}

export function FormularioLote({ fincas, densidad }: { fincas: { id: string; nombre: string }[]; densidad: number }) {
  return (
    <FormularioGenerico
      accion={accionCrearLote}
      boton="Crear lote"
      ocultos={fincas.length === 1 ? { fincaId: fincas[0].id } : {}}
      campos={[
        ...(fincas.length > 1 ? [{ nombre: "fincaId", etiqueta: "Finca", tipo: "select" as const, opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })), ancho: "completo" as const }] : []),
        { nombre: "nombre", etiqueta: "Nombre del lote", requerido: true, placeholder: "La Cima", ancho: "completo" },
        { nombre: "codigo", etiqueta: "Código", requerido: true, placeholder: "L-04" },
        { nombre: "areaHa", etiqueta: "Hectáreas", tipo: "number", requerido: true },
        { nombre: "yaSembrado", etiqueta: "Ya está sembrado", tipo: "checkbox" },
        { nombre: "variedad", etiqueta: "Variedad de café (opcional)", placeholder: "Castillo, Cenicafé 1…", ancho: "completo", visibleSi: "yaSembrado" },
        { nombre: "fechaSiembra", etiqueta: "Fecha de siembra", tipo: "date", visibleSi: "yaSembrado" },
        { nombre: "numeroArboles", etiqueta: "Árboles", tipo: "number", inputMode: "numeric", visibleSi: "yaSembrado", ayuda: `Referencia: unos ${densidad.toLocaleString("es-CO")} por hectárea.` },
      ]}
    />
  );
}

export function FormularioEventoLote({ loteId, estado, densidad, areaHa }: { loteId: string; estado: string; densidad: number; areaHa: string | null }) {
  const sembrado = estado !== "sin_sembrar";
  const sugeridos = areaHa ? String(Math.round(Number(areaHa) * densidad)) : "";
  const opciones = sembrado
    ? [
        { valor: "zoca", texto: "Zoca: se cortó el café para que rebrote" },
        { valor: "tumba", texto: "Tumba: se arrancó el café (queda sin sembrar)" },
        { valor: "observacion", texto: "Nota u observación" },
      ]
    : [
        { valor: "siembra", texto: "Siembra de café nuevo" },
        { valor: "observacion", texto: "Nota u observación" },
      ];
  return (
    <FormularioGenerico
      accion={accionEventoLote}
      boton="Registrar"
      ocultos={{ loteId }}
      campos={[
        { nombre: "tipo", etiqueta: "¿Qué se hizo?", tipo: "select", opciones, requerido: true, ancho: "completo" },
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true },
        { nombre: "arboles", etiqueta: sembrado ? "Árboles (solo si es siembra)" : "Árboles sembrados", tipo: "number", inputMode: "numeric", valorInicial: sembrado ? "" : sugeridos },
        ...(sembrado ? [] : [{ nombre: "variedad", etiqueta: "Variedad de café sembrada (opcional)", placeholder: "Castillo, Cenicafé 1…" }]),
        { nombre: "detalle", etiqueta: "Detalle (opcional)" },
      ]}
    />
  );
}

export function EliminarLote({ loteId, nombre }: { loteId: string; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(accionEliminarLote, {});
  return (
    <form action={accion} onSubmit={(e) => { if (!confirm(`¿Eliminar el lote "${nombre}"? Esta acción no se puede deshacer.`)) e.preventDefault(); }}>
      <input type="hidden" name="loteId" value={loteId} />
      <button disabled={pendiente} className="min-h-11 rounded-lg px-2 text-sm font-medium text-alerta hover:bg-alerta/5 disabled:opacity-60">Eliminar lote</button>
      <Mensaje estado={estado} />
    </form>
  );
}
