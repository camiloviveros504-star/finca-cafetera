import Link from "next/link";
import { ErrorProhibido, listarClientes, servicios } from "@/composicion";
import { exigirContexto } from "../../_servidor/sesion";
import { FormularioCliente } from "./FormularioCliente";

export const metadata = { title: "Clientes · Gestión de Finca Cafetera" };

export default async function Clientes({ searchParams }: { searchParams: Promise<{ pagina?: string; q?: string }> }) {
  const ctx = await exigirContexto();
  const { pagina: p, q } = await searchParams;
  const pagina = Math.max(Number(p ?? 1) || 1, 1);
  let datos;
  try {
    datos = await listarClientes(servicios().clientes, ctx, pagina, q);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar clientes.</p>;
    throw error;
  }
  const paginas = Math.max(Math.ceil(datos.total / 25), 1);
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-extrabold">Clientes</h1>
      <form className="flex gap-2" role="search">
        <label className="sr-only" htmlFor="q">Buscar por nombre</label>
        <input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre" className="min-h-11 flex-1 rounded-lg border-2 border-cafe/40 bg-white px-3 text-base" />
        <button className="min-h-11 rounded-lg border-2 border-cafe px-4 font-bold">Buscar</button>
      </form>
      {ctx.permisos.has("cliente:administrar") && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo cliente</summary>
          <div className="mt-3"><FormularioCliente /></div>
        </details>
      )}
      {datos.filas.length === 0 ? (
        <p className="rounded-lg bg-pergamino p-4">No hay clientes que coincidan.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {datos.filas.map((c) => (
            <li key={c.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
              <p className="font-bold">{c.nombre}</p>
              <p className="text-sm">{[c.documento, c.telefono, c.correo].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
              <p className="text-xs">{c.autorizoEn ? "Tratamiento de datos autorizado" : "Sin autorización registrada"}</p>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
        {pagina > 1 ? <Link className="min-h-11 py-3 font-bold underline" href={`/clientes?pagina=${pagina - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>← Anterior</Link> : <span />}
        <span>Página {pagina} de {paginas}</span>
        {pagina < paginas ? <Link className="min-h-11 py-3 font-bold underline" href={`/clientes?pagina=${pagina + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Siguiente →</Link> : <span />}
      </nav>
    </section>
  );
}
