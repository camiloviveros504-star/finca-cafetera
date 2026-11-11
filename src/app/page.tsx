import Image from "next/image";
import Link from "next/link";
import { HeroCarousel, type ImagenHero } from "./_componentes/HeroCarousel";
import { Logo } from "./_componentes/Logo";
import { PieDePagina } from "./_componentes/PieDePagina";

const IMAGENES: ImagenHero[] = [
  { base: "/images/hero-1-paisaje-cafetero", alt: "Ladera andina sembrada de café con una casa campesina al amanecer" },
  { base: "/images/hero-2-recoleccion", alt: "Manos de un recolector tomando cerezas maduras de café sobre un canasto" },
  { base: "/images/hero-3-caficultores", alt: "Grupo de caficultores recolectando café en una ladera" },
  { base: "/images/hero-4-beneficio-lavado", alt: "Tanque de lavado con café en pergamino recién despulpado" },
  { base: "/images/hero-5-secado", alt: "Café pergamino secándose en un secador parabólico" },
];

const MODULOS = [
  { imagen: "modulo-lotes-aereo", titulo: "Lotes", texto: "Cada lote con su área, si es café nuevo o zoca, su edad y su plan de abonada.", alt: "Vista aérea de una finca cafetera dividida en lotes, con quebrada y casa de teja" },
  { imagen: "hero-2-recoleccion", titulo: "Recolección", texto: "Kilos por lote y por trabajador en un solo formulario, incluso sin señal.", alt: "Manos de un recolector tomando cerezas maduras de café sobre un canasto" },
  { imagen: "modulo-sanidad-inspeccion", titulo: "Insumos", texto: "Compras que suman al inventario y abonadas por bultos o gramos por árbol.", alt: "Agrónomo revisando con lupa las cerezas de una rama de café y tomando notas" },
  { imagen: "modulo-ventas-catacion", titulo: "Ventas", texto: "Venda por tipo de café a su precio; lo vendido sale de la bodega.", alt: "Mesa de catación con tazas de café, granos tostados y café verde frente a una ventana con montañas cafeteras" },
  { imagen: "hero-3-caficultores", titulo: "Equipo", texto: "Lo que gana cada trabajador por kilo o por jornal, y lo que ya se le pagó.", alt: "Grupo de caficultores recolectando café en una ladera" },
  { imagen: "hero-5-secado", titulo: "Billetera", texto: "Cobros, fletes, compras y pagos: el saldo de la finca sin hacer cuentas.", alt: "Café pergamino secándose en un secador parabólico" },
];

function Foto({ base, alt, prioridad = false }: { base: string; alt: string; prioridad?: boolean }) {
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={`/images/${base}-sm.webp`} />
      <Image src={`/images/${base}.webp`} alt={alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" unoptimized priority={prioridad} className="object-cover transition-transform duration-500 group-hover:scale-105" />
    </picture>
  );
}

export default function Inicio() {
  return (
    <div className="bg-fondo text-tinta">
      <div className="relative">
        <header className="absolute inset-x-0 top-0 z-30 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <span className="flex items-center gap-2.5 text-base font-bold text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.6),0_1px_3px_rgba(0,0,0,0.5)]"><Logo className="size-9" />Gestión de Finca Cafetera</span>
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-bold text-tinta shadow hover:bg-arena">
              Iniciar sesión
            </Link>
          </div>
        </header>
        <HeroCarousel imagenes={IMAGENES}>
          <div className="mx-auto max-w-xl text-center text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.6),0_1px_3px_rgba(0,0,0,0.5)] md:mx-0 md:text-left">
            <h1 className="text-[clamp(1.9rem,5vw,3.25rem)] font-bold leading-tight">Del lote a la venta, cada kilo con su origen</h1>
            <p className="mt-3 text-[clamp(1rem,2.2vw,1.2rem)] text-white/90">
              Lotes, recolección, insumos, trabajadores, ventas y dinero de su finca cafetera, claros y en un solo lugar.
            </p>
            <Link href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-white px-8 text-base font-semibold text-tinta shadow-lg [text-shadow:none] hover:bg-fondo">
              Ingresar al sistema
            </Link>
          </div>
        </HeroCarousel>
      </div>


      <section className="bg-arena" aria-labelledby="modulos">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 id="modulos" className="text-2xl font-bold tracking-tight md:text-3xl">Lo que lleva su finca, en un solo lugar</h2>
          <p className="mt-2 max-w-2xl text-suave">El dueño maneja su finca; el capataz anota el trabajo del día; cada trabajador ve sus kilos.</p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((m) => (
              <li key={m.titulo} className="group overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Foto base={m.imagen} alt={m.alt} />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold">{m.titulo}</h3>
                  <p className="mt-1 text-sm text-tinta/85">{m.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold md:text-3xl">Acceso para equipos autorizados</h2>
        <p className="mx-auto mt-2 max-w-xl text-suave">Las cuentas las crea el administrador; cada persona ve solo lo que le corresponde.</p>
        <Link href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-bosque px-8 text-base font-semibold text-white shadow-sm hover:bg-bosque/90">
          Iniciar sesión
        </Link>
      </section>
      <PieDePagina oscuro />
    </div>
  );
}
