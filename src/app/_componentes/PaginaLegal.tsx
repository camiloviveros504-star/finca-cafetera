import Link from "next/link";
import { PieDePagina } from "./PieDePagina";

/** Marco de las páginas públicas de políticas: encabezado sobrio, contenido legible y pie con enlaces. */
export function PaginaLegal({ titulo, actualizada, children }: { titulo: string; actualizada: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-fondo">
      <header className="bg-tinta px-4 py-4 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="font-semibold">Gestión de Finca Cafetera</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border border-white/50 px-4 text-sm font-semibold hover:bg-white/10">Iniciar sesión</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold">{titulo}</h1>
        <p className="mt-1 text-sm text-tinta/70">Última actualización: {actualizada}</p>
        <div className="mt-6 space-y-5 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_table]:text-left [&_table]:text-sm [&_td]:border-b [&_td]:border-tinta/15 [&_td]:p-2 [&_th]:bg-arena [&_th]:p-2">
          {children}
        </div>
      </main>
      <PieDePagina />
    </div>
  );
}
