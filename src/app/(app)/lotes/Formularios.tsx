"use client";

import { useActionState } from "react";
import { accionCrearFinca, accionCrearLote } from "./acciones";

const campo = "min-h-11 w-full rounded-lg border-2 border-cafe/40 bg-white px-3 text-base focus:border-cafetal";

function Mensaje({ estado }: { estado: { ok?: boolean; error?: string; mensaje?: string; campos?: Record<string, string> } }) {
  if (estado.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-cereza sm:col-span-2">
        {estado.error}
        {estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
      </p>
    );
  }
  return estado.ok ? <p role="status" className="text-sm font-semibold text-cafetal sm:col-span-2">{estado.mensaje}</p> : null;
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
      <button disabled={pendiente} className="min-h-11 self-end rounded-lg bg-cafetal px-4 font-bold text-white disabled:opacity-60">Crear finca</button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function FormularioLote({ fincas }: { fincas: { id: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(accionCrearLote, {});
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Finca
        <select name="fincaId" className={campo}>{fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Código
        <input name="codigo" required placeholder="L-04" className={campo} />
      </label>
      <label className="block text-sm font-semibold">Nombre
        <input name="nombre" required className={campo} />
      </label>
      <label className="block text-sm font-semibold">Variedad
        <input name="variedad" className={campo} />
      </label>
      <label className="block text-sm font-semibold">Área (ha)
        <input name="areaHa" inputMode="decimal" className={campo} />
      </label>
      <label className="block text-sm font-semibold">Número de árboles
        <input name="numeroArboles" inputMode="numeric" className={campo} />
      </label>
      <button disabled={pendiente} className="min-h-11 rounded-lg bg-cafetal px-4 font-bold text-white disabled:opacity-60 sm:col-span-2">Crear lote</button>
      <Mensaje estado={estado} />
    </form>
  );
}
