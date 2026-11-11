"use client";

import { useActionState } from "react";
import { accionIniciarSesion } from "./acciones";

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(accionIniciarSesion, {});
  return (
    <form action={accion} className="space-y-5" noValidate>
      <div>
        <label htmlFor="correo" className="mb-1 block text-sm font-semibold">
          Correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          required
          className="min-h-11 w-full rounded-lg border-2 border-tinta/40 bg-white px-3 text-base focus:border-bosque"
        />
      </div>
      <div>
        <label htmlFor="contrasena" className="mb-1 block text-sm font-semibold">
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 w-full rounded-lg border-2 border-tinta/40 bg-white px-3 text-base focus:border-bosque"
        />
      </div>
      {estado.error && (
        <p role="alert" className="rounded-lg border-2 border-alerta bg-white p-3 text-sm font-semibold text-alerta">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pendiente}
        className="min-h-12 w-full rounded-lg bg-bosque px-4 text-base font-bold text-white hover:bg-bosque/90 disabled:opacity-60"
      >
        {pendiente ? "Ingresando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
