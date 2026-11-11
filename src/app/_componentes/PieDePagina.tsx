import Link from "next/link";

/** Pie de página común: enlaces a las políticas de privacidad y de cookies. */
export function PieDePagina({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <footer className={`px-4 py-6 text-sm sm:px-6 lg:px-8 ${oscuro ? "bg-tinta text-white/85" : "text-tinta/80"}`}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p>© {new Date().getFullYear()} Gestión de Finca Cafetera</p>
        <nav aria-label="Información legal" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/privacidad" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Política de privacidad</Link>
          <Link href="/cookies" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Política de cookies</Link>
        </nav>
      </div>
    </footer>
  );
}
