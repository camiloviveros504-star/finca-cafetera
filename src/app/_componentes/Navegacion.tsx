"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface EnlaceNav {
  href: string;
  etiqueta: string;
  icono: string;
}

function activo(ruta: string, href: string) {
  return ruta === href || ruta.startsWith(href + "/");
}

/** Barra inferior en celular (< lg). */
export function BarraInferior({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-cafe/20 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {enlaces.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          aria-current={activo(ruta, e.href) ? "page" : undefined}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
            activo(ruta, e.href) ? "bg-cafetal text-white" : "text-cafe"
          }`}
        >
          <span aria-hidden className="text-lg leading-none">
            {e.icono}
          </span>
          {e.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

/** Navegación lateral fija desde lg. */
export function BarraLateral({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="hidden w-60 shrink-0 flex-col gap-1 p-3 lg:flex">
      {enlaces.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          aria-current={activo(ruta, e.href) ? "page" : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
            activo(ruta, e.href) ? "bg-cafetal text-white" : "hover:bg-pergamino"
          }`}
        >
          <span aria-hidden>{e.icono}</span>
          {e.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
