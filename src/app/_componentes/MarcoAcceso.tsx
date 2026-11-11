import Image from "next/image";
import Link from "next/link";
import { PieDePagina } from "./PieDePagina";

/**
 * Marco de las pantallas de acceso (inicio de sesión e instalación): imagen clara a un lado en pantallas medianas y
 * grandes (hero-2 con foco al 40 % desde lg; login-fondo en pantallas medianas) y franja de 160 px en celular.
 */
export function MarcoAcceso({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-fondo">
      <main className="grid flex-1 md:grid-cols-2">
        <div className="relative hidden md:block">
          <Image src="/images/login-fondo.webp" alt="Manos de un recolector con cerezas de café y un canasto" fill sizes="(min-width: 1024px) 0px, 50vw" className="object-cover lg:hidden" priority />
          <Image
            src="/images/hero-2-recoleccion.webp"
            alt="Manos de un recolector tomando cerezas maduras de café sobre un canasto"
            fill
            sizes="50vw"
            className="hidden object-cover lg:block"
            style={{ objectPosition: "40% center" }}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-tinta/55 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 right-8 max-w-md rounded-xl bg-tinta/55 p-5 text-white backdrop-blur-sm">
            <p className="text-lg font-extrabold">Del lote a la venta, cada kilo con su origen.</p>
            <p className="mt-1 text-sm text-white/85">Producción, inventario, trabajadores, ventas y finanzas con trazabilidad completa.</p>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="relative h-40 md:hidden">
            <Image src="/images/hero-2-recoleccion-sm.webp" alt="Manos de un recolector tomando cerezas maduras de café sobre un canasto" fill sizes="100vw" className="object-cover" priority />
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6">
            <Link href="/" className="mb-8 text-sm font-bold text-tinta/70 hover:text-tinta">← Gestión de Finca Cafetera</Link>
            <h1 className="text-3xl font-extrabold">{titulo}</h1>
            <p className="mb-7 mt-2 text-tinta/75">{subtitulo}</p>
            {children}
          </div>
        </div>
      </main>
      <PieDePagina />
    </div>
  );
}
