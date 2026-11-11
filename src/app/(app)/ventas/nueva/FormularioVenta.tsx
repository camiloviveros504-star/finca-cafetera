"use client";

import { useActionState, useState } from "react";
import { accionRegistrarVenta } from "../acciones";

interface Props {
  fincas: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  productos: { id: string; codigo: string; nombre: string }[];
}

const campo = "min-h-11 w-full rounded-lg border-2 border-cafe/40 bg-white px-3 text-base focus:border-cafetal";

export function FormularioVenta({ fincas, clientes, productos }: Props) {
  const [estado, accion, pendiente] = useActionState(accionRegistrarVenta, {});
  // Clave de idempotencia generada una vez por formulario: un reintento no duplica la venta.
  const [clave] = useState(() => crypto.randomUUID());
  return (
    <form action={accion} className="mx-auto max-w-xl space-y-4 pb-24 md:grid md:grid-cols-2 md:gap-4 md:space-y-0" noValidate>
      <input type="hidden" name="claveIdempotencia" value={clave} />
      <div>
        <label htmlFor="fincaId" className="mb-1 block text-sm font-semibold">Finca</label>
        <select id="fincaId" name="fincaId" className={campo} defaultValue={fincas[0]?.id}>
          {fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="clienteId" className="mb-1 block text-sm font-semibold">Cliente</label>
        <select id="clienteId" name="clienteId" className={campo}>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="productoId" className="mb-1 block text-sm font-semibold">Producto</label>
        <select id="productoId" name="productoId" className={campo}>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="cantidad" className="mb-1 block text-sm font-semibold">Cantidad (kg)</label>
        <input id="cantidad" name="cantidad" inputMode="decimal" autoComplete="off" required placeholder="0" className={campo} aria-describedby="ayuda-cantidad" />
        <p id="ayuda-cantidad" className="mt-1 text-xs">El precio lo define la tarifa vigente; no se escribe aquí.</p>
      </div>
      {estado.error && (
        <p role="alert" className="rounded-lg border-2 border-cereza bg-white p-3 text-sm font-semibold text-cereza md:col-span-2">
          {estado.error}
          {estado.campos && Object.values(estado.campos).length > 0 && (
            <span className="block font-normal">{Object.values(estado.campos).join(" · ")}</span>
          )}
        </p>
      )}
      <div className="fixed inset-x-0 bottom-14 z-20 bg-papel/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:col-span-2 md:bg-transparent md:p-0 lg:bottom-0">
        <button
          type="submit"
          disabled={pendiente}
          className="min-h-12 w-full rounded-lg bg-cafetal px-4 text-base font-bold text-white disabled:opacity-60 md:w-auto md:px-8"
        >
          {pendiente ? "Registrando…" : "Registrar venta"}
        </button>
      </div>
    </form>
  );
}
