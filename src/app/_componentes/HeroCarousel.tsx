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
 * Carrusel de fondo (QA-09) que cambia solo, sin flechas ni botones. Solo la 1.ª imagen se carga con prioridad; las demás
 * se montan cuando se acerca su turno. En celular se sirve la versión -sm. Se pausa cuando la pestaña no está visible y no
 * rota con prefers-reduced-motion. El indicador de posición es solo informativo.
 */
export function HeroCarousel({ imagenes, children }: { imagenes: ImagenHero[]; children: React.ReactNode }) {
  const [actual, setActual] = useState(0);
  const [montadas, setMontadas] = useState<Set<number>>(new Set([0]));
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
    if (sinMovimiento || oculta) return;
    const t = setInterval(() => ir(actual + 1), INTERVALO_MS);
    return () => clearInterval(t);
  }, [actual, ir, oculta, sinMovimiento]);

  return (
    <section ref={raiz} aria-label="Paisajes y procesos del café" className="relative h-[100svh] min-h-[36rem] overflow-hidden bg-[#0e1f18]">
      {imagenes.map((img, i) => {
        if (!montadas.has(i)) return null;
        const comunes = { alt: img.alt, fill: true, sizes: "100vw", unoptimized: true, priority: i === 0, loading: i === 0 ? undefined : ("lazy" as const) };
        const grande = getImageProps({ ...comunes, src: `${img.base}.webp` }).props;
        const chica = getImageProps({ ...comunes, src: `${img.base}-sm.webp` }).props;
        const visible = i === actual;
        return (
          <picture key={img.base} className={`absolute inset-0 block transition-opacity duration-[1500ms] ${visible ? "opacity-100" : "opacity-0"}`}>
            <source media="(max-width: 767px)" srcSet={chica.src} />
            <img {...grande} alt={visible ? img.alt : ""} className="object-cover" />
          </picture>
        );
      })}
      {/* Velo suave del lado del texto: la imagen se ve clara y las letras llevan sombra, sin cajas de color. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0e1f18]/85 via-[#0e1f18]/40 to-transparent max-md:bg-gradient-to-t max-md:from-[#0e1f18]/90 max-md:via-[#0e1f18]/45 max-md:to-[#0e1f18]/20" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0e1f18]/70 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-14 pt-24 sm:px-6 md:justify-center md:pb-0 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {imagenes.map((img, i) => (
          <span key={img.base} className={`block h-1.5 rounded-full transition-all duration-500 ${i === actual ? "w-8 bg-white" : "w-3 bg-white/60"}`} />
        ))}
      </div>
    </section>
  );
}
