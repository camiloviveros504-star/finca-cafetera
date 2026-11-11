"use client";

import { getImageProps } from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

function suscribirseAMovimiento(avisar: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

function suscribirseAVisibilidad(avisar: () => void) {
  document.addEventListener("visibilitychange", avisar);
  return () => document.removeEventListener("visibilitychange", avisar);
}

export interface ImagenHero {
  base: string; // p. ej. "/images/hero-1-paisaje-cafetero"
  alt: string;
}

const INTERVALO_MS = 6000;

/**
 * Carrusel de fondo (QA-09). Solo la 1.ª imagen se carga con prioridad; las demás se montan cuando se acerca su turno.
 * En celular se sirve la versión -sm. Pausa con mouse, foco y pestaña oculta; sin rotación con prefers-reduced-motion.
 */
export function HeroCarousel({ imagenes, children }: { imagenes: ImagenHero[]; children: React.ReactNode }) {
  const [actual, setActual] = useState(0);
  const [montadas, setMontadas] = useState<Set<number>>(new Set([0]));
  const [pausado, setPausado] = useState(false);
  const sinMovimiento = useSyncExternalStore(suscribirseAMovimiento, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const oculta = useSyncExternalStore(suscribirseAVisibilidad, () => document.hidden, () => false);
  const raiz = useRef<HTMLElement>(null);

  const ir = useCallback(
    (i: number) => {
      const n = (i + imagenes.length) % imagenes.length;
      setActual(n);
      setMontadas((m) => new Set(m).add(n).add((n + 1) % imagenes.length));
    },
    [imagenes.length],
  );

  // Precarga diferida de la siguiente imagen poco después de mostrar la actual.
  useEffect(() => {
    if (sinMovimiento) return;
    const t = setTimeout(() => setMontadas((m) => new Set(m).add((actual + 1) % imagenes.length)), 2500);
    return () => clearTimeout(t);
  }, [actual, imagenes.length, sinMovimiento]);

  useEffect(() => {
    if (sinMovimiento || pausado || oculta) return;
    const t = setInterval(() => ir(actual + 1), INTERVALO_MS);
    return () => clearInterval(t);
  }, [actual, ir, pausado, oculta, sinMovimiento]);

  return (
    <section
      ref={raiz}
      aria-roledescription="carrusel"
      aria-label="Paisajes y procesos del café"
      className="relative h-svh min-h-[34rem] overflow-hidden bg-cafe"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={(e) => {
        if (!raiz.current?.contains(e.relatedTarget as Node | null)) setPausado(false);
      }}
    >
      {imagenes.map((img, i) => {
        if (!montadas.has(i)) return null;
        const comunes = { alt: img.alt, fill: true, sizes: "100vw", unoptimized: true, priority: i === 0, loading: i === 0 ? undefined : ("lazy" as const) };
        const grande = getImageProps({ ...comunes, src: `${img.base}.webp` }).props;
        const chica = getImageProps({ ...comunes, src: `${img.base}-sm.webp` }).props;
        const visible = i === actual;
        return (
          <picture
            key={img.base}
            className={`absolute inset-0 block transition-opacity duration-1000 ${visible ? "opacity-100" : "opacity-0"}`}
          >
            <source media="(max-width: 767px)" srcSet={chica.src} />
            <img {...grande} alt={visible ? img.alt : ""} className="object-cover" />
          </picture>
        );
      })}
      {/* Degradado café para contraste AA; más fuerte en celular. */}
      <div className="absolute inset-0 bg-gradient-to-t from-cafe/90 via-cafe/70 to-cafe/60 md:from-cafe/80 md:via-cafe/65 md:to-cafe/55" />

      <div className="relative z-10 flex h-full flex-col justify-center px-4 text-center sm:px-6 md:text-left lg:px-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label="Imagen anterior"
          onClick={() => ir(actual - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-cafe hover:bg-white"
        >
          ‹
        </button>
        <div className="flex">
          {imagenes.map((img, i) => (
            <button
              key={img.base}
              type="button"
              aria-label={`Ir a la imagen ${i + 1} de ${imagenes.length}`}
              aria-current={i === actual}
              onClick={() => ir(i)}
              className="flex h-11 w-8 items-center justify-center"
            >
              <span className={`block h-3 rounded-full transition-all ${i === actual ? "w-6 bg-dorado" : "w-3 bg-white/80"}`} />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Imagen siguiente"
          onClick={() => ir(actual + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-cafe hover:bg-white"
        >
          ›
        </button>
      </div>
    </section>
  );
}
