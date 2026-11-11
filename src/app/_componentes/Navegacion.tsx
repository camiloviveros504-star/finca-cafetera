"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icono, type NombreIcono } from "./Icono";

export interface EnlaceNav {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  /** Sección del menú (Mi finca, Café y ventas…): se muestra como título sobre sus opciones. */
  grupo?: string;
  /** Herramientas que se usan poco: quedan dentro de "Más herramientas", plegadas. */
  secundario?: boolean;
}

function activo(ruta: string, href: string) {
  return ruta === href || ruta.startsWith(href + "/");
}

/** Agrupa los enlaces por sección conservando el orden. */
function porGrupo(enlaces: EnlaceNav[]) {
  const grupos: { titulo?: string; enlaces: EnlaceNav[] }[] = [];
  for (const e of enlaces) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === e.grupo) ultimo.enlaces.push(e);
    else grupos.push({ titulo: e.grupo, enlaces: [e] });
  }
  return grupos;
}

function ItemLateral({ e, ruta }: { e: EnlaceNav; ruta: string }) {
  const actual = activo(ruta, e.href);
  return (
    <Link
      href={e.href}
      aria-current={actual ? "page" : undefined}
      className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
        actual ? "bg-bosque-claro font-semibold text-bosque" : "font-medium text-tinta/80 hover:bg-fondo hover:text-tinta"
      }`}
    >
      <Icono nombre={e.icono} className={`size-[18px] shrink-0 ${actual ? "text-bosque" : "text-suave"}`} />
      {e.etiqueta}
    </Link>
  );
}

/** Navegación lateral de altura completa (desde lg). Las herramientas poco usadas van plegadas al final. */
export function BarraLateral({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();
  const principales = enlaces.filter((e) => !e.secundario);
  const secundarios = enlaces.filter((e) => e.secundario);
  const [verMas, setVerMas] = useState(() => secundarios.some((e) => activo(ruta, e.href)));
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">
      {porGrupo(principales).map((g, i) => (
        <div key={g.titulo ?? `g${i}`} className="flex flex-col gap-0.5">
          {g.titulo && <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-suave">{g.titulo}</p>}
          {g.enlaces.map((e) => <ItemLateral key={e.href} e={e} ruta={ruta} />)}
        </div>
      ))}
      {secundarios.length > 0 && (
        <div className="mt-4 border-t border-borde pt-3">
          <button type="button" onClick={() => setVerMas((v) => !v)} aria-expanded={verMas} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-suave hover:bg-fondo hover:text-tinta">
            <Icono nombre="herramientas" className="size-[18px]" />
            Más herramientas
            <svg aria-hidden viewBox="0 0 20 20" className={`ml-auto size-4 transition-transform ${verMas ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5z" /></svg>
          </button>
          {verMas && <div className="mt-0.5 flex flex-col gap-0.5">{secundarios.map((e) => <ItemLateral key={e.href} e={e} ruta={ruta} />)}</div>}
        </div>
      )}
    </nav>
  );
}

/** Barra inferior en celular (< lg): cuatro accesos principales y "Más" con el resto, agrupado. */
export function BarraInferior({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const visibles = enlaces.filter((e) => !e.secundario);
  const principales = enlaces.length > 5 ? visibles.slice(0, 4) : enlaces;
  const resto = enlaces.length > 5 ? enlaces.filter((e) => !principales.includes(e)) : [];
  return (
    <>
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button aria-label="Cerrar" className="absolute inset-0 bg-tinta/50" onClick={() => setAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {porGrupo(resto.map((e) => (e.secundario ? { ...e, grupo: "Más herramientas" } : e))).map((g, i) => (
              <div key={g.titulo ?? `g${i}`}>
                {g.titulo && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-suave">{g.titulo}</p>}
                <ul>
                  {g.enlaces.map((e) => (
                    <li key={e.href}>
                      <Link href={e.href} onClick={() => setAbierto(false)} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 font-medium ${activo(ruta, e.href) ? "bg-bosque-claro text-bosque" : "hover:bg-fondo"}`}>
                        <Icono nombre={e.icono} className="size-5 text-suave" />
                        {e.etiqueta}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-borde bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {principales.map((e) => {
          const actual = activo(ruta, e.href);
          return (
            <Link key={e.href} href={e.href} aria-current={actual ? "page" : undefined} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${actual ? "text-bosque" : "text-suave"}`}>
              <Icono nombre={e.icono} className="size-5" />
              {e.etiqueta}
            </Link>
          );
        })}
        {resto.length > 0 && (
          <button onClick={() => setAbierto(true)} aria-haspopup="dialog" className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-suave">
            <Icono nombre="mas" className="size-5" />
            Más
          </button>
        )}
      </nav>
    </>
  );
}
