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
  { imagen: "modulo-lotes-aereo", titulo: "Fincas y lotes", texto: "Cada lote con su área, variedad y todo lo que se cosecha en él.", alt: "Vista aérea de una finca cafetera dividida en lotes, con quebrada y casa de teja" },
  { imagen: "hero-2-recoleccion", titulo: "Cosechas", texto: "Registro en cuatro pasos desde el celular, incluso sin señal.", alt: "Manos de un recolector tomando cerezas maduras de café sobre un canasto" },
  { imagen: "hero-3-caficultores", titulo: "Trabajadores", texto: "Producción validada, liquidaciones, anticipos y pagos con tarifas históricas.", alt: "Grupo de caficultores recolectando café en una ladera" },
  { imagen: "hero-4-beneficio-lavado", titulo: "Beneficio", texto: "Despulpado, lavado y transformaciones sin perder el origen del lote.", alt: "Tanque de lavado con café en pergamino recién despulpado" },
  { imagen: "modulo-inventario-bodega", titulo: "Inventario", texto: "Existencias por movimientos: nunca se vende más de lo que hay.", alt: "Bodega con sacos de café verde y una pala metálica" },
  { imagen: "modulo-ventas-catacion", titulo: "Ventas y clientes", texto: "Pedidos, ventas, pagos y cartera con el lote de cada kilo vendido.", alt: "Mesa de catación con tazas de café, granos tostados y café verde frente a una ventana con montañas cafeteras" },
  { imagen: "modulo-sanidad-inspeccion", titulo: "Sanidad", texto: "Inspecciones, agroquímicos con vencimiento y aplicaciones registradas.", alt: "Agrónomo revisando con lupa las cerezas de una rama de café y tomando notas" },
  { imagen: "modulo-planificacion-floracion", titulo: "Planificación", texto: "Actividades programadas y proyección de cosecha frente a lo real.", alt: "Rama de café con flores blancas en plena floración frente a montañas cafeteras" },
  { imagen: "hero-5-secado", titulo: "Secado y poscosecha", texto: "Cada etapa registra entrada, salida, pérdida y responsable.", alt: "Café pergamino secándose en un secador parabólico" },
];

const PILARES = [
  ["Consistencia", "Una venta y su descuento de existencias ocurren juntos o no ocurren. Dos ventas a la vez nunca dejan el inventario en negativo."],
  ["Trazabilidad", "De cada venta se llega al lote, a las etapas de beneficio y a las cosechas, con fechas y cantidades."],
  ["Seguridad", "Cada persona ve y hace solo lo que su rol permite, y cada operación sensible queda en la auditoría."],
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
            <span className="flex items-center gap-2.5 rounded-xl bg-white/95 py-1.5 pl-1.5 pr-4 text-sm font-extrabold text-tinta shadow"><Logo className="size-8" />Gestión de Finca Cafetera</span>
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-bold text-tinta shadow hover:bg-arena">
              Iniciar sesión
            </Link>
          </div>
        </header>
        <HeroCarousel imagenes={IMAGENES}>
          <div className="mx-auto max-w-xl rounded-2xl bg-tinta/85 p-6 text-center text-white shadow-xl md:mx-0 md:p-8 md:text-left">
            <h1 className="text-[clamp(1.9rem,5vw,3.25rem)] font-extrabold leading-tight">Del lote a la venta, cada kilo con su origen</h1>
            <p className="mt-3 text-[clamp(1rem,2.2vw,1.2rem)] text-white/90">
              Gestión de fincas cafeteras: producción, inventario, trabajadores, ventas y finanzas en un solo lugar, con trazabilidad completa.
            </p>
            <Link href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-ambar px-8 text-base font-extrabold text-tinta hover:bg-white">
              Ingresar al sistema
            </Link>
          </div>
        </HeroCarousel>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="pilares">
        <h2 id="pilares" className="text-2xl font-extrabold md:text-3xl">Control, trazabilidad y seguridad en cada operación</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {PILARES.map(([titulo, texto]) => (
            <li key={titulo} className="rounded-xl border border-tinta/15 bg-white p-5">
              <h3 className="text-lg font-extrabold">{titulo}</h3>
              <p className="mt-2 text-tinta/85">{texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-arena" aria-labelledby="modulos">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 id="modulos" className="text-2xl font-extrabold md:text-3xl">Módulos del sistema</h2>
          <p className="mt-2 max-w-2xl text-tinta/85">Del cultivo al cliente: cada etapa en su módulo, con los permisos de cada rol.</p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((m) => (
              <li key={m.titulo} className="group overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Foto base={m.imagen} alt={m.alt} />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-extrabold">{m.titulo}</h3>
                  <p className="mt-1 text-sm text-tinta/85">{m.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-extrabold md:text-3xl">Acceso para equipos autorizados</h2>
        <p className="mx-auto mt-2 max-w-xl text-tinta/85">Las cuentas las crea el administrador de cada organización y definen lo que cada persona puede hacer.</p>
        <Link href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-bosque px-8 text-base font-extrabold text-white hover:opacity-90">
          Iniciar sesión
        </Link>
      </section>
      <PieDePagina oscuro />
    </div>
  );
}
