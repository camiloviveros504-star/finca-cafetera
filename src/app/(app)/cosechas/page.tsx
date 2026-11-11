import Link from "next/link";
import { ErrorProhibido, listarCosechas, servicios } from "@/composicion";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Cosechas · Gestión de Finca Cafetera" };

export default async function Cosechas({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const ctx = await exigirContexto();
  const pagina = Math.max(Number((await searchParams).pagina ?? 1) || 1, 1);
  let datos;
  try {
    datos = await listarCosechas(servicios().produccion, ctx, pagina);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar cosechas.</p>;
    throw error;
  }
  const paginas = Math.max(Math.ceil(datos.total / 25), 1);
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Cosechas</h1>
        {ctx.permisos.has("cosecha:registrar") && (
          <Link href="/cosechas/nueva" className="flex min-h-11 items-center rounded-lg bg-cafetal px-4 font-bold text-white">
            Registrar cosecha
          </Link>
        )}
      </div>
      {datos.filas.length === 0 ? (
        <p className="rounded-lg bg-pergamino p-4">Todavía no hay cosechas registradas.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {datos.filas.map((c) => (
            <li key={c.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
              <p className="font-bold">{c.productoNombre}</p>
              <p className="text-sm">Lote {c.loteCodigo} · {c.fecha}</p>
              <p className="mt-1 text-lg font-extrabold">{cantidad(c.cantidad)} {c.unidadCodigo}</p>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
        {pagina > 1 ? <Link className="min-h-11 py-3 font-bold underline" href={`/cosechas?pagina=${pagina - 1}`}>← Anterior</Link> : <span />}
        <span>Página {pagina} de {paginas}</span>
        {pagina < paginas ? <Link className="min-h-11 py-3 font-bold underline" href={`/cosechas?pagina=${pagina + 1}`}>Siguiente →</Link> : <span />}
      </nav>
    </section>
  );
}
