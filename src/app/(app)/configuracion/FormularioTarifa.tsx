"use client";

import { useActionState } from "react";
import { accionCrearVersionTarifa } from "./acciones";

const campo = "min-h-11 w-full rounded-lg border-2 border-cafe/40 bg-white px-3 text-base focus:border-cafetal";

export function FormularioTarifa({ tarifaId, hoy }: { tarifaId: string; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(accionCrearVersionTarifa, {});
  return (
    <form action={accion} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="tarifaId" value={tarifaId} />
      <div>
        <label htmlFor={`valor-${tarifaId}`} className="mb-1 block text-sm font-semibold">Nuevo valor (COP)</label>
        <input id={`valor-${tarifaId}`} name="valor" inputMode="decimal" required className={campo} />
      </div>
      <div>
        <label htmlFor={`desde-${tarifaId}`} className="mb-1 block text-sm font-semibold">Vigente desde</label>
        <input id={`desde-${tarifaId}`} name="desde" type="date" min={hoy} defaultValue={hoy} required className={campo} />
      </div>
      <button disabled={pendiente} className="min-h-11 rounded-lg bg-cafetal px-4 font-bold text-white disabled:opacity-60">
        {pendiente ? "Guardando…" : "Crear versión"}
      </button>
      {estado.error && <p role="alert" className="text-sm font-semibold text-cereza sm:col-span-3">{estado.error}</p>}
      {estado.ok && <p role="status" className="text-sm font-semibold text-cafetal sm:col-span-3">{estado.mensaje}</p>}
    </form>
  );
}
