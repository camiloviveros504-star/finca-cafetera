import Image from "next/image";

/**
 * Emblema de la marca (hojas, grano y paisaje cafetero). Imagen propia con fondo transparente, servida en WebP liviano;
 * el nombre del sistema se escribe aparte en texto para que siempre se lea nítido.
 */
export function Logo({ className = "size-9" }: { className?: string }) {
  return <Image src="/marca/logo.webp" alt="Gestión de Finca Cafetera" width={96} height={96} className={`shrink-0 object-contain ${className.replace(/\bshadow-\S+/g, "")}`} />;
}
