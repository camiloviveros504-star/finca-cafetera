import Image from "next/image";
import { redirect } from "next/navigation";
import { contextoActual } from "../_servidor/sesion";
import { FormularioLogin } from "./FormularioLogin";

export const metadata = { title: "Iniciar sesión · Gestión de Finca Cafetera" };

export default async function PaginaLogin() {
  if (await contextoActual()) redirect("/inicio");
  return (
    <main className="grid min-h-svh bg-pergamino md:grid-cols-2">
      {/* Panel de imagen: login-fondo en pantallas medianas; hero-2-recoleccion desde lg (decisión del equipo). */}
      <div className="relative hidden md:block">
        <Image
          src="/images/login-fondo.webp"
          alt="Manos de un recolector con cerezas de café y un canasto"
          fill
          sizes="(min-width: 1024px) 0px, 50vw"
          className="object-cover lg:hidden"
          priority
        />
        <Image
          src="/images/hero-2-recoleccion.webp"
          alt="Manos de un recolector tomando cerezas maduras de café sobre un canasto"
          fill
          sizes="50vw"
          className="hidden object-cover lg:block"
          style={{ objectPosition: "40% center" }}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cafe/70 to-transparent" />
      </div>
      <div className="flex flex-col">
        {/* En celular: franja de imagen de 160 px. */}
        <div className="relative h-40 md:hidden">
          <Image
            src="/images/hero-2-recoleccion-sm.webp"
            alt="Manos de un recolector tomando cerezas maduras de café sobre un canasto"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-extrabold">Gestión de Finca Cafetera</h1>
          <p className="mb-6 mt-1 text-sm">Ingrese con su cuenta para continuar.</p>
          <FormularioLogin />
          <p className="mt-6 text-xs">
            Imágenes ilustrativas generadas con IA; no muestran fincas ni personas reales. Datos de demostración (DEMO).
          </p>
        </div>
      </div>
    </main>
  );
}
