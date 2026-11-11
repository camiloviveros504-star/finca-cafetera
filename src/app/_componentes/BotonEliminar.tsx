"use client";

import { useActionState } from "react";
import { accionEliminarRegistro } from "../(app)/acciones-eliminar";

/** Botón de eliminar con confirmación. Sirve para cualquier registro eliminable (compradores, proveedores, insumos, trabajadores…). */
export function BotonEliminar({ tipo, id, nombre }: { tipo: "cliente" | "proveedor" | "insumo" | "trabajador" | "equipo" | "actividad"; id: string; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(accionEliminarRegistro, {});
  return (
    <form action={accion} onSubmit={(e) => { if (!confirm(`¿Eliminar "${nombre}"? Si ya tiene historial se archivará en lugar de borrarse.`)) e.preventDefault(); }} className="inline-block">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <button disabled={pendiente} className="min-h-11 rounded-lg border-2 border-alerta px-3 text-sm font-bold text-alerta disabled:opacity-60">{pendiente ? "Eliminando…" : "Eliminar"}</button>
      {estado.error && <span role="alert" className="ml-2 text-sm font-semibold text-alerta">{estado.error}</span>}
      {estado.ok && <span role="status" className="ml-2 text-sm font-semibold text-bosque">{estado.mensaje}</span>}
    </form>
  );
}
