"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface EnlaceNav {
  href: string;
  etiqueta: string;
  icono: string;
  /** Sección del menú (Mi finca, Insumos, Café y ventas…): se muestra como título sobre sus opciones. */
  grupo?: string;
}

/** Inserta el título de cada sección cuando cambia el grupo. */
function conTitulos(enlaces: EnlaceNav[]) {
  let anterior: string | undefined;
  return enlaces.map((e) => {
    const titulo = e.grupo && e.grupo !== anterior ? e.grupo : undefined;
    anterior = e.grupo;
    return { e, titulo };
  });
}

function activo(ruta: string, href: string) {
  return ruta === href || ruta.startsWith(href + "/");
}

/** Barra inferior en celular (< lg): hasta 4 accesos y un botón "Más" con el resto. */
export function BarraInferior({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const principales = enlaces.length > 5 ? enlaces.slice(0, 4) : enlaces;
  const resto = enlaces.length > 5 ? enlaces.slice(4) : [];
  return (
    <>
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button aria-label="Cerrar" className="absolute inset-0 bg-tinta/60" onClick={() => setAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ul className="space-y-1">
              {conTitulos(resto).map(({ e, titulo }) => (
                <li key={e.href}>
                  {titulo && <p className="px-3 pb-1 pt-3 text-xs font-extrabold uppercase tracking-wide text-tinta/60">{titulo}</p>}
                  <Link href={e.href} onClick={() => setAbierto(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 font-semibold hover:bg-arena">
                    <span aria-hidden>{e.icono}</span>
                    {e.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-tinta/20 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {principales.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo(ruta, e.href) ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${activo(ruta, e.href) ? "bg-bosque text-white" : "text-tinta"}`}
          >
            <span aria-hidden className="text-lg leading-none">{e.icono}</span>
            {e.etiqueta}
          </Link>
        ))}
        {resto.length > 0 && (
          <button onClick={() => setAbierto(true)} aria-haspopup="dialog" className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-tinta">
            <span aria-hidden className="text-lg leading-none">⋯</span>
            Más
          </button>
        )}
      </nav>
    </>
  );
}

/** Navegación lateral fija desde lg. */
export function BarraLateral({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="hidden w-60 shrink-0 flex-col gap-1 p-3 lg:flex">
      {conTitulos(enlaces).map(({ e, titulo }) => (
        <div key={e.href} className="contents">
          {titulo && <p className="px-3 pb-1 pt-4 text-xs font-extrabold uppercase tracking-wide text-tinta/60">{titulo}</p>}
          <Link
            href={e.href}
            aria-current={activo(ruta, e.href) ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
              activo(ruta, e.href) ? "bg-bosque text-white" : "hover:bg-arena"
            }`}
          >
            <span aria-hidden>{e.icono}</span>
            {e.etiqueta}
          </Link>
        </div>
      ))}
    </nav>
  );
}
