import Image from "next/image";
import Link from "next/link";
import { HeroCarousel, type ImagenHero } from "./_componentes/HeroCarousel";
import { Icono, type NombreIcono } from "./_componentes/Icono";
import { Logo } from "./_componentes/Logo";

const IMAGENES: ImagenHero[] = [
  { base: "/images/hero-1-paisaje-cafetero", alt: "Ladera andina sembrada de café con una casa campesina al amanecer" },
  { base: "/images/hero-2-recoleccion", alt: "Manos de un recolector tomando cerezas maduras de café sobre un canasto" },
  { base: "/images/hero-3-caficultores", alt: "Grupo de caficultores recolectando café en una ladera" },
  { base: "/images/hero-4-beneficio-lavado", alt: "Tanque de lavado con café en pergamino recién despulpado" },
  { base: "/images/hero-5-secado", alt: "Café pergamino secándose en un secador parabólico" },
];

const PASOS: [NombreIcono, string, string][] = [
  ["lote", "Registre sus lotes", "Hectáreas, si el café es nuevo o zoca y desde cuándo está sembrado. El sistema calcula la edad y el plan de abonada."],
  ["recoleccion", "Anote el trabajo del día", "Kilos por lote y por trabajador, abonadas y jornales. Desde el celular, incluso sin señal en el cafetal."],
  ["billetera", "Venda y vea su dinero", "Venda por tipo de café a su precio. Cobros, fletes y pagos caen solos en la billetera de la finca."],
];

const MODULOS: { imagen: string; icono: NombreIcono; titulo: string; texto: string; alt: string }[] = [
  { imagen: "modulo-lotes-aereo", icono: "lote", titulo: "Lotes", texto: "Café nuevo, zoca o sin sembrar; edad, árboles y lo cosechado en cada lote.", alt: "Vista aérea de una finca cafetera dividida en lotes" },
  { imagen: "hero-2-recoleccion", icono: "recoleccion", titulo: "Recolección", texto: "Kilos por trabajador con su valor por kilo; el café entra solo a la bodega.", alt: "Manos de un recolector tomando cerezas maduras de café" },
  { imagen: "modulo-sanidad-inspeccion", icono: "insumo", titulo: "Insumos", texto: "Compras que suman al inventario y abonadas por bultos o gramos por árbol.", alt: "Agrónomo revisando con lupa las cerezas de una rama de café" },
  { imagen: "modulo-ventas-catacion", icono: "venta", titulo: "Ventas", texto: "Pasilla, pergamino seco, almendra o tostado, cada uno a su precio.", alt: "Mesa de catación con tazas de café y granos" },
  { imagen: "hero-3-caficultores", icono: "equipo", titulo: "Equipo", texto: "Lo que gana cada trabajador por kilo o jornal, y lo que ya se le pagó.", alt: "Grupo de caficultores recolectando café en una ladera" },
  { imagen: "hero-5-secado", icono: "billetera", titulo: "Billetera", texto: "Lo que entró, lo que salió y el saldo de la finca, sin hacer cuentas.", alt: "Café pergamino secándose en un secador parabólico" },
];

const ROLES: [string, string][] = [
  ["Propietario", "Maneja todo lo de su finca: lotes, insumos, equipo, ventas y dinero."],
  ["Capataz", "Anota la recolección y las labores del personal. No ve ventas ni dinero."],
  ["Trabajador", "Consulta sus propios kilos, jornales y lo que le han pagado."],
  ["Administrador", "Da de alta fincas y cuentas. No opera ninguna finca."],
];

function Foto({ base, alt }: { base: string; alt: string }) {
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={`/images/${base}-sm.webp`} />
      <Image src={`/images/${base}.webp`} alt={alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" unoptimized className="object-cover transition-transform duration-700 group-hover:scale-105" />
    </picture>
  );
}

export default function Portada() {
  return (
    <div className="bg-white text-tinta">
      <div className="relative">
        <header className="absolute inset-x-0 top-0 z-30 px-5 py-5 sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 text-white">
              <Logo className="size-10 shadow-lg" />
              <span className="text-[15px] font-semibold leading-tight tracking-tight">Gestión de<br className="sm:hidden" /> Finca Cafetera</span>
            </Link>
            <nav aria-label="Secciones" className="flex items-center gap-1 sm:gap-2">
              <a href="#como-funciona" className="hidden min-h-11 items-center rounded-lg px-4 text-sm font-medium text-white/90 hover:text-white md:inline-flex">Cómo funciona</a>
              <a href="#modulos" className="hidden min-h-11 items-center rounded-lg px-4 text-sm font-medium text-white/90 hover:text-white md:inline-flex">Módulos</a>
              <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-tinta shadow-lg hover:bg-fondo">Iniciar sesión</Link>
            </nav>
          </div>
        </header>

        <HeroCarousel imagenes={IMAGENES}>
          <div className="max-w-3xl text-white">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#cfe9de]">
              <span className="size-1.5 rounded-full bg-[#7fd1ad]" />
              Control de finca cafetera
            </p>
            <h1 className="text-[clamp(2.25rem,6vw,4.25rem)] font-bold leading-[1.05] tracking-tight">Del lote a la venta, cada kilo con su origen</h1>
            <p className="mt-5 max-w-xl text-[clamp(1rem,2vw,1.2rem)] leading-relaxed text-white/85">
              Lotes, recolección, insumos, trabajadores, ventas y dinero de su finca en un solo lugar. Claro para el dueño, sencillo para el capataz.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-white px-7 text-base font-semibold text-tinta shadow-xl hover:bg-fondo">
                Ingresar al sistema
                <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </Link>
              <a href="#como-funciona" className="inline-flex min-h-12 items-center rounded-lg border border-white/40 px-7 text-base font-semibold text-white hover:bg-white/10">Cómo funciona</a>
            </div>
          </div>
        </HeroCarousel>
      </div>

      <section id="como-funciona" className="scroll-mt-6 px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="titulo-pasos">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bosque">Cómo funciona</p>
          <h2 id="titulo-pasos" className="mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">Tres pasos y su finca queda al día</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {PASOS.map(([icono, titulo, texto], i) => (
              <li key={titulo} className="relative rounded-2xl border border-borde bg-white p-7 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-bosque text-white shadow-md shadow-bosque/20"><Icono nombre={icono} className="size-6" /></span>
                  <span className="text-5xl font-bold text-bosque/10">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold">{titulo}</h3>
                <p className="mt-2 leading-relaxed text-suave">{texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="modulos" className="scroll-mt-6 bg-fondo px-5 py-20 sm:px-8 lg:py-28" aria-labelledby="titulo-modulos">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-bosque">Módulos</p>
              <h2 id="titulo-modulos" className="mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">Lo que lleva su finca, en un solo lugar</h2>
            </div>
            <p className="max-w-md text-suave">Cada módulo se conecta con los demás: lo que se recoge entra a la bodega, lo que se vende sale de ella y el dinero llega a la billetera.</p>
          </div>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((m) => (
              <li key={m.titulo} className="group overflow-hidden rounded-2xl border border-borde bg-white shadow-sm transition-shadow hover:shadow-lg">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Foto base={m.imagen} alt={m.alt} />
                  <span className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-xl bg-white/95 text-bosque shadow"><Icono nombre={m.icono} className="size-5" /></span>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold">{m.titulo}</h3>
                  <p className="mt-1.5 leading-relaxed text-suave">{m.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[#0e1f18] px-5 py-20 text-white sm:px-8 lg:py-28" aria-labelledby="titulo-roles">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7fd1ad]">Acceso por roles</p>
            <h2 id="titulo-roles" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Cada persona ve solo lo suyo</h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/75">Las cuentas no se crean solas: el administrador da de alta cada finca y su dueño invita a su equipo. Cada operación queda registrada.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {ROLES.map(([rol, texto]) => (
              <li key={rol} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <p className="font-semibold">{rol}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center rounded-3xl bg-bosque px-6 py-14 text-center text-white shadow-xl shadow-bosque/20 sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Su finca, clara y al día</h2>
          <p className="mt-3 max-w-xl text-white/80">Ingrese con la cuenta que le entregó el administrador de su finca.</p>
          <Link href="/login" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-white px-8 text-base font-semibold text-bosque shadow-lg hover:bg-fondo">
            Iniciar sesión
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      <footer className="border-t border-borde px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-sm text-suave">
          <div className="flex items-center gap-2.5"><Logo className="size-7" /><span>© {new Date().getFullYear()} Gestión de Finca Cafetera</span></div>
          <nav aria-label="Información legal" className="flex gap-5">
            <Link href="/privacidad" className="inline-flex min-h-11 items-center hover:text-tinta">Política de privacidad</Link>
            <Link href="/cookies" className="inline-flex min-h-11 items-center hover:text-tinta">Política de cookies</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
