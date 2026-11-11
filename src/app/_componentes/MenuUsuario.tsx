"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { accionCerrarSesion } from "../login/acciones";

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/**
 * Menú de la persona que inició sesión: iniciales, nombre y rol, con acceso a las políticas y al cierre de sesión.
 * Se cierra con clic fuera o con Escape; el botón de salida es un formulario (funciona sin JavaScript adicional).
 */
export function MenuUsuario({ nombre, correo, roles }: { nombre: string; correo: string; roles: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const rolTexto = roles.map((r) => r.replaceAll("_", " ")).join(", ");
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Menú de ${nombre}`}
        onClick={() => setAbierto((a) => !a)}
        className="flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-fondo"
      >
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-bosque text-sm font-semibold text-white">{iniciales(nombre)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-40 truncate text-sm font-semibold">{nombre}</span>
          <span className="block max-w-40 truncate text-xs capitalize text-suave">{rolTexto}</span>
        </span>
        <svg aria-hidden viewBox="0 0 20 20" className={`size-4 text-suave transition-transform ${abierto ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5z" /></svg>
      </button>

      {abierto && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl bg-white text-tinta shadow-xl ring-1 ring-tinta/10">
          <div className="border-b border-tinta/10 bg-arena px-4 py-3">
            <p className="truncate font-bold">{nombre}</p>
            <p className="truncate text-sm text-tinta/75">{correo}</p>
            <p className="mt-1 inline-block rounded-full bg-tinta/10 px-2 py-0.5 text-xs font-semibold capitalize">{rolTexto}</p>
          </div>
          <Link role="menuitem" href="/privacidad" className="flex min-h-11 items-center px-4 text-sm hover:bg-arena">Política de privacidad</Link>
          <Link role="menuitem" href="/cookies" className="flex min-h-11 items-center px-4 text-sm hover:bg-arena">Política de cookies</Link>
          <form action={accionCerrarSesion} className="border-t border-tinta/10">
            <button role="menuitem" className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-bold text-alerta hover:bg-alerta/10">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
              </svg>
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
