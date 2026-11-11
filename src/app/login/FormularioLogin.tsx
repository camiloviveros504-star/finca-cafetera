"use client";

import { useActionState } from "react";
import { CampoContrasena } from "../_componentes/CampoContrasena";
import { accionIniciarSesion } from "./acciones";

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(accionIniciarSesion, {});
  return (
    <form action={accion} className="space-y-5" noValidate>
      <div>
        <label htmlFor="correo" className="mb-1.5 block text-sm font-medium">Correo</label>
        <div className="relative">
          <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
          </svg>
          <input
            id="correo"
            name="correo"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="nombre@correo.com"
            className="min-h-12 w-full rounded-lg border border-[#cdd3d0] bg-white pl-10 pr-3 text-base shadow-sm placeholder:text-suave/70 focus:border-bosque focus:outline-none focus:ring-2 focus:ring-bosque/20"
          />
        </div>
      </div>
      <CampoContrasena nombre="contrasena" etiqueta="Contraseña" autoComplete="current-password" />
      {estado.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-alerta/40 bg-alerta/5 p-3 text-sm font-semibold text-alerta">
          <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pendiente}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-bosque px-4 text-base font-semibold text-white shadow-sm transition hover:bg-bosque/90 disabled:opacity-70"
      >
        {pendiente && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {pendiente ? "Verificando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
