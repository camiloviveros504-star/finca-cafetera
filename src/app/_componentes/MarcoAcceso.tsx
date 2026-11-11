import Image from "next/image";
import Link from "next/link";
import { Logo } from "./Logo";
import { PieDePagina } from "./PieDePagina";

const ICONOS = {
  trazabilidad: "M4 6h16M4 12h10M4 18h6M18 14l2 2 3-4",
  roles: "M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6l-8-3zM9 12l2 2 4-4",
  auditoria: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
} as const;

const PUNTOS: [keyof typeof ICONOS, string, string][] = [
  ["trazabilidad", "Trazabilidad completa", "De cada venta al lote, al beneficio y a la cosecha."],
  ["roles", "Acceso por roles y fincas", "Cada persona ve y hace solo lo que le corresponde."],
  ["auditoria", "Auditoría de cada operación", "Registro que no se puede modificar ni borrar."],
];

/**
 * Marco de las pantallas de acceso (inicio de sesión, instalación y activación de cuenta): panel de marca con imagen
 * clara en pantallas medianas y grandes (hero-2 con foco al 40 % desde lg; login-fondo en medianas) y franja de 160 px
 * en celular. Sin efectos de desenfoque: el texto va sobre paneles sólidos.
 */
export function MarcoAcceso({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-fondo">
      <main className="grid flex-1 md:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden md:block" aria-label="Presentación del sistema">
          <Image src="/images/login-fondo.webp" alt="Manos de un recolector con cerezas de café y un canasto" fill sizes="(min-width: 1024px) 0px, 50vw" className="object-cover lg:hidden" priority />
          <Image src="/images/hero-2-recoleccion.webp" alt="Manos de un recolector tomando cerezas maduras de café sobre un canasto" fill sizes="52vw" className="hidden object-cover lg:block" style={{ objectPosition: "40% center" }} priority />
          <div className="absolute inset-0 bg-gradient-to-t from-tinta/45 via-transparent to-tinta/15" />
          <div className="absolute left-8 top-8 flex items-center gap-3 rounded-xl bg-white/95 py-2 pl-2 pr-4 shadow">
            <Logo className="size-9" />
            <span className="text-sm font-extrabold leading-tight text-tinta">Gestión de<br />Finca Cafetera</span>
          </div>
          <ul className="absolute inset-x-8 bottom-8 grid max-w-lg gap-3">
            {PUNTOS.map(([icono, t, d]) => (
              <li key={t} className="flex items-start gap-3 rounded-xl bg-tinta/80 p-4 text-white shadow-lg">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONOS[icono]} /></svg>
                </span>
                <span><strong className="block text-sm">{t}</strong><span className="text-sm text-white/85">{d}</span></span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex flex-col">
          <div className="relative h-40 md:hidden">
            <Image src="/images/hero-2-recoleccion-sm.webp" alt="Manos de un recolector tomando cerezas maduras de café sobre un canasto" fill sizes="100vw" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-tinta/50 to-transparent" />
            <Link href="/" className="absolute bottom-3 left-4 flex items-center gap-2 rounded-lg bg-white/95 py-1.5 pl-1.5 pr-3 text-sm font-extrabold shadow"><Logo className="size-7" />Finca Cafetera</Link>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10 sm:px-6">
            <Link href="/" className="mb-8 hidden text-sm font-semibold text-tinta/65 hover:text-tinta md:inline-flex md:min-h-11 md:items-center">← Volver al sitio</Link>
            <h1 className="text-3xl font-extrabold tracking-tight">{titulo}</h1>
            <p className="mb-7 mt-2 text-tinta/75">{subtitulo}</p>
            {children}
            {pie && <div className="mt-8 border-t border-tinta/10 pt-6 text-sm text-tinta/75">{pie}</div>}
          </div>
        </div>
      </main>
      <PieDePagina />
    </div>
  );
}
