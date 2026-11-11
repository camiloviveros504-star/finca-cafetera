import Image from "next/image";
import Link from "next/link";
import { Logo } from "./Logo";

/**
 * Marco de las pantallas de acceso (inicio de sesión, instalación y activación de cuenta).
 * Escritorio: foto a la izquierda con la marca y una sola línea; formulario en tarjeta a la derecha.
 * Celular: la foto se reduce a una franja y el formulario ocupa la pantalla.
 */
export function MarcoAcceso({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-fondo lg:flex-row">
      <aside className="relative h-44 shrink-0 overflow-hidden sm:h-56 lg:h-auto lg:w-[46%]" aria-label="Gestión de Finca Cafetera">
        <Image src="/images/hero-2-recoleccion.webp" alt="" fill sizes="(min-width: 1024px) 46vw, 100vw" className="object-cover" style={{ objectPosition: "40% center" }} priority />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1d17]/85 via-[#0f1d17]/35 to-[#0f1d17]/20" />
        <Link href="/" className="absolute left-5 top-5 flex items-center gap-2.5 text-white lg:left-10 lg:top-10">
          <Logo className="size-9" />
          <span className="text-sm font-semibold leading-tight">Gestión de<br />Finca Cafetera</span>
        </Link>
        <div className="absolute inset-x-5 bottom-5 text-white lg:inset-x-10 lg:bottom-12">
          <p className="max-w-md text-lg font-semibold leading-snug lg:text-2xl">Control de su finca cafetera, del lote a la venta.</p>
          <p className="mt-2 hidden max-w-md text-sm text-white/80 lg:block">Lotes, recolección, insumos, personal, ventas y dinero en un mismo lugar.</p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px] rounded-2xl border border-borde bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
            <p className="mb-6 mt-1.5 text-sm text-suave">{subtitulo}</p>
            {children}
            {pie && <div className="mt-6 border-t border-borde pt-5 text-sm text-suave">{pie}</div>}
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-5 pb-6 text-xs text-suave">
          <span>© {new Date().getFullYear()} Gestión de Finca Cafetera</span>
          <Link href="/privacidad" className="hover:text-tinta">Política de privacidad</Link>
          <Link href="/cookies" className="hover:text-tinta">Política de cookies</Link>
        </footer>
      </main>
    </div>
  );
}
