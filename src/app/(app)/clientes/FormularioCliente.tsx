"use client";

import { useActionState } from "react";
import { accionCrearCliente } from "./acciones";

const campo = "min-h-11 w-full rounded-lg border-2 border-tinta/40 bg-white px-3 text-base focus:border-bosque";

export function FormularioCliente() {
  const [estado, accion, pendiente] = useActionState(accionCrearCliente, {});
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2" noValidate>
      <label className="block text-sm font-semibold sm:col-span-2">Nombre o razón social
        <input name="nombre" required className={campo} autoComplete="off" />
      </label>
      <label className="block text-sm font-semibold">Documento
        <input name="documento" className={campo} autoComplete="off" />
      </label>
      <label className="block text-sm font-semibold">Teléfono
        <input name="telefono" type="tel" className={campo} autoComplete="off" />
      </label>
      <label className="block text-sm font-semibold">Correo
        <input name="correo" type="email" className={campo} autoComplete="off" />
      </label>
      <label className="block text-sm font-semibold">Dirección
        <input name="direccion" className={campo} autoComplete="off" />
      </label>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input name="autorizaTratamiento" type="checkbox" className="mt-1 h-6 w-6 shrink-0" />
        <span>
          El titular autorizó el tratamiento de sus datos personales para la gestión comercial y la cartera de ventas
          (Ley 1581 de 2012). Puede pedir acceso, rectificación o supresión en cualquier momento.
        </span>
      </label>
      <button disabled={pendiente} className="min-h-11 rounded-lg bg-bosque px-4 font-bold text-white disabled:opacity-60 sm:col-span-2">Guardar cliente</button>
      {estado.error && (
        <p role="alert" className="text-sm font-semibold text-alerta sm:col-span-2">
          {estado.error}
          {estado.campos ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
        </p>
      )}
      {estado.ok && <p role="status" className="text-sm font-semibold text-bosque sm:col-span-2">{estado.mensaje}</p>}
    </form>
  );
}
