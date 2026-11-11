import Image from "next/image";
import Link from "next/link";
import { Logo } from "./Logo";

/**
 * Marco de las pantallas de acceso (inicio de sesión, instalación y activación de cuenta).
 * Escritorio: foto a pantalla completa con degradado verde y titular; panel blanco con el formulario centrado.
 * Celular: franja de foto con la marca y el titular; el formulario ocupa el resto.
 */
export function MarcoAcceso({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-white lg:flex-row">
      <aside className="relative h-56 shrink-0 overflow-hidden bg-[#0e1f18] sm:h-64 lg:sticky lg:top-0 lg:h-svh lg:w-[52%]" aria-label="Gestión de Finca Cafetera">
        <Image src="/images/hero-1-paisaje-cafetero.webp" alt="" fill sizes="(min-width: 1024px) 52vw, 100vw" className="object-cover opacity-90" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0e1f18]/90 via-[#12382b]/55 to-[#0e1f18]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1f18]/95 via-transparent to-transparent" />

        <div className="relative flex h-full flex-col justify-between p-6 text-white sm:p-8 lg:p-14">
          <Link href="/" className="flex w-fit items-center gap-3">
            <Logo className="size-10 shadow-lg" />
            <span className="text-[15px] font-semibold leading-tight tracking-tight">Gestión de<br />Finca Cafetera</span>
          </Link>
          <div className="max-w-xl">
            <p className="mb-3 hidden text-xs font-semibold uppercase tracking-[0.18em] text-[#a9d5c2] lg:block">Control de finca cafetera</p>
            <h2 className="text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-[2.75rem]">Del lote a la venta,<br className="hidden sm:block" /> cada kilo con su origen.</h2>
            <p className="mt-4 hidden max-w-md text-base leading-relaxed text-white/80 lg:block">Lotes, recolección, insumos, trabajadores, ventas y dinero de su finca en un mismo lugar, claros y al día.</p>
            <div className="mt-8 hidden h-1 w-16 rounded-full bg-[#a9d5c2] lg:block" />
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="hidden justify-end px-10 pt-8 lg:flex">
          <Link href="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-suave hover:bg-fondo hover:text-tinta">
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Volver al inicio
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight">{titulo}</h1>
            <p className="mb-8 mt-2 text-[15px] text-suave">{subtitulo}</p>
            {children}
            {pie && <div className="mt-8 rounded-xl bg-fondo p-4 text-sm leading-relaxed text-suave">{pie}</div>}
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-6 pb-6 text-xs text-suave lg:justify-between lg:px-10">
          <span>© {new Date().getFullYear()} Gestión de Finca Cafetera</span>
          <nav aria-label="Información legal" className="flex gap-5">
            <Link href="/privacidad" className="inline-flex min-h-11 items-center hover:text-tinta">Política de privacidad</Link>
            <Link href="/cookies" className="inline-flex min-h-11 items-center hover:text-tinta">Política de cookies</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
