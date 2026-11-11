"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CampoContrasena } from "../../_componentes/CampoContrasena";
import { accionActivar } from "./acciones";

export function FormularioActivacion({ token, esAlta }: { token: string; esAlta: boolean }) {
  const [estado, accion, pendiente] = useActionState(accionActivar, {});
  return (
    <form action={accion} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <CampoContrasena nombre="contrasena" etiqueta="Nueva contraseña" autoComplete="new-password" conFortaleza />
      <CampoContrasena nombre="confirmacion" etiqueta="Repita la contraseña" autoComplete="new-password" />
      {esAlta && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acepta" required className="mt-0.5 size-5 shrink-0" />
          <span>
            Autorizo el tratamiento de mis datos personales según la{" "}
            <Link href="/privacidad" target="_blank" className="font-semibold underline">política de privacidad</Link>.
          </span>
        </label>
      )}
      {estado.error && (
        <p role="alert" className="rounded-lg border border-alerta/40 bg-alerta/5 p-3 text-sm font-semibold text-alerta">
          {estado.error}
          {estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
        </p>
      )}
      <button
        type="submit"
        disabled={pendiente}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-bosque px-4 text-base font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-70"
      >
        {pendiente && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {pendiente ? "Guardando…" : esAlta ? "Activar mi cuenta" : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
