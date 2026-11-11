import Link from "next/link";
import { HeroCarousel, type ImagenHero } from "./_componentes/HeroCarousel";

const IMAGENES: ImagenHero[] = [
  { base: "/images/hero-1-paisaje-cafetero", alt: "Ladera andina sembrada de café con una casa campesina al amanecer" },
  { base: "/images/hero-2-recoleccion", alt: "Manos de un recolector tomando cerezas maduras de café sobre un canasto" },
  { base: "/images/hero-3-caficultores", alt: "Grupo de caficultores recolectando café en una ladera" },
  { base: "/images/hero-4-beneficio-lavado", alt: "Tanque de lavado con café en pergamino recién despulpado" },
  { base: "/images/hero-5-secado", alt: "Café pergamino secándose en un secador parabólico" },
];

export default function Inicio() {
  return (
    <main className="bg-cafe text-white">
      <HeroCarousel imagenes={IMAGENES}>
        <h1 className="text-[clamp(2rem,6vw,3.75rem)] font-extrabold leading-tight">Gestión de Finca Cafetera</h1>
        <p className="mx-auto mt-3 max-w-xl text-[clamp(1rem,2.5vw,1.25rem)] md:mx-0">
          Del lote a la venta: cada kilo de café con su origen, su fecha y su destino.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-dorado px-8 text-base font-extrabold text-cafe hover:bg-white"
        >
          Iniciar sesión
        </Link>
        <ul className="mx-auto mt-8 grid max-w-xl gap-3 text-sm sm:grid-cols-3 md:mx-0" aria-label="Indicadores de demostración">
          {[
            ["Trazabilidad", "lote → cosecha → venta"],
            ["Inventario", "sin ventas por encima de existencias"],
            ["Campo", "cosechas sin conexión"],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg bg-cafe/70 p-3">
              <strong className="block">{t}</strong>
              {d}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs">
          Imágenes ilustrativas generadas con IA; no muestran fincas ni personas reales. Datos de demostración (DEMO).
        </p>
      </HeroCarousel>
    </main>
  );
}
