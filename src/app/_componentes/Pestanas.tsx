import Link from "next/link";

/**
 * Pestañas por enlace (?ver=…): cada pestaña es una dirección propia, funciona sin JavaScript y el botón “atrás” del
 * navegador las respeta. Sirve para separar una página en tareas (consultar, registrar, historial) sin amontonar cajas.
 */
export function Pestanas({ base, actual, pestanas }: { base: string; actual: string; pestanas: { clave: string; texto: string; cuenta?: number }[] }) {
  return (
    <nav aria-label="Secciones" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-borde">
        {pestanas.map((p) => {
          const activa = p.clave === actual;
          return (
            <li key={p.clave}>
              <Link
                href={`${base}?ver=${p.clave}`}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${activa ? "border-bosque text-bosque" : "border-transparent text-suave hover:text-tinta"}`}
              >
                {p.texto}
                {p.cuenta !== undefined && <span className={`rounded-full px-2 py-0.5 text-xs ${activa ? "bg-bosque-claro" : "bg-fondo"}`}>{p.cuenta}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tarjeta blanca estándar con título opcional. */
export function Tarjeta({ titulo, children, className = "" }: { titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borde bg-white p-5 shadow-sm ${className}`}>
      {titulo && <h2 className="mb-4 text-sm font-semibold">{titulo}</h2>}
      {children}
    </section>
  );
}
