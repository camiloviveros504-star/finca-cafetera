import Image from "next/image";

/**
 * Encabezado de módulo (catálogo de imágenes, tabla 15.1): 120 px en celular y 200 px en escritorio.
 * Los módulos administrativos sin foto propia usan un encabezado sobrio con color de la paleta.
 */
export function EncabezadoModulo({ titulo, imagen, alt, detalle }: { titulo: string; imagen?: string; alt?: string; detalle?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-tinta ${imagen ? "h-[120px] lg:h-[200px]" : "py-4"}`}>
      {imagen && (
        <>
          <picture>
            <source media="(max-width: 767px)" srcSet={`/images/${imagen}-sm.webp`} />
            <Image src={`/images/${imagen}.webp`} alt={alt ?? ""} fill sizes="100vw" unoptimized className="object-cover" />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-tinta/70 via-tinta/10 to-transparent" />
        </>
      )}
      <div className={imagen ? "absolute bottom-3 left-4 right-4" : "relative px-4"}>
        <h1 className="text-2xl font-extrabold text-white lg:text-4xl">{titulo}</h1>
        {detalle && <p className="text-sm text-white/90">{detalle}</p>}
      </div>
    </div>
  );
}
