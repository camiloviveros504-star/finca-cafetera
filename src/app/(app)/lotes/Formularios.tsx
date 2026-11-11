"use client";

import { useActionState } from "react";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { accionCrearFinca, accionCrearLote, accionEliminarLote, accionEventoLote } from "./acciones";

const campo = "min-h-11 w-full rounded-lg border-2 border-tinta/40 bg-white px-3 text-base focus:border-bosque";

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

export function FormularioFinca() {
  const [estado, accion, pendiente] = useActionState(accionCrearFinca, {});
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Nombre
        <input name="nombre" required className={campo} />
      </label>
      <label className="block text-sm font-semibold">Ubicación
        <input name="ubicacion" className={campo} />
      </label>
      <label className="block text-sm font-semibold">Área (ha)
        <input name="areaHa" inputMode="decimal" className={campo} />
      </label>
      <button disabled={pendiente} className="min-h-11 self-end rounded-lg bg-bosque px-4 font-bold text-white disabled:opacity-60">Crear finca</button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function FormularioLote({ fincas, densidad }: { fincas: { id: string; nombre: string }[]; densidad: number }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">Deje la fecha de siembra vacía si el lote aún no tiene café. Si ya está sembrado, indique la fecha y cuántos árboles tiene (referencia: unos {densidad.toLocaleString("es-CO")} árboles por hectárea).</p>
      <FormularioGenerico
        accion={accionCrearLote}
        boton="Crear lote"
        campos={[
          { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })) },
          { nombre: "codigo", etiqueta: "Código", requerido: true, placeholder: "L-04" },
          { nombre: "nombre", etiqueta: "Nombre del lote", requerido: true },
          { nombre: "areaHa", etiqueta: "Área (hectáreas)", tipo: "number", requerido: true },
          { nombre: "variedad", etiqueta: "Variedad (opcional)" },
          { nombre: "fechaSiembra", etiqueta: "Fecha de siembra (si ya está sembrado)", tipo: "date" },
          { nombre: "numeroArboles", etiqueta: "Árboles sembrados", tipo: "number", inputMode: "numeric" },
        ]}
      />
    </div>
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
        { nombre: "tipo", etiqueta: "¿Qué se hizo?", tipo: "select", opciones, requerido: true },
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true },
        { nombre: "arboles", etiqueta: sembrado ? "Árboles (solo si es siembra)" : "Árboles sembrados", tipo: "number", inputMode: "numeric", valorInicial: sembrado ? "" : sugeridos },
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
      <button disabled={pendiente} className="min-h-11 rounded-lg border-2 border-alerta px-3 text-sm font-bold text-alerta disabled:opacity-60">Eliminar lote</button>
      <Mensaje estado={estado} />
    </form>
  );
}
