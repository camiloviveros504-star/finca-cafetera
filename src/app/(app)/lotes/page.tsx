import Image from "next/image";
import { ErrorProhibido, listarFincasYLotes, servicios } from "@/composicion";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { FormularioFinca, FormularioLote } from "./Formularios";

export const metadata = { title: "Fincas y lotes · Gestión de Finca Cafetera" };

export default async function Lotes() {
  const ctx = await exigirContexto();
  let datos;
  try {
    datos = await listarFincasYLotes(servicios().fincasLotes, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar lotes.</p>;
    throw error;
  }
  return (
    <section className="space-y-6">
      {/* Encabezado con imagen del módulo: 120 px en celular y 200 px en escritorio. */}
      <div className="relative h-[120px] overflow-hidden rounded-xl bg-cafe lg:h-[200px]">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/modulo-lotes-aereo-sm.webp" />
          <Image src="/images/modulo-lotes-aereo.webp" alt="Vista aérea de una finca cafetera dividida en lotes, con quebrada y casa de teja" fill sizes="100vw" unoptimized className="object-cover" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-cafe/85 to-cafe/30" />
        <h1 className="absolute bottom-3 left-4 text-2xl font-extrabold text-white lg:text-4xl">Fincas y lotes</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {datos.fincas.map((f) => (
          <div key={f.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
            <p className="font-extrabold">{f.nombre}</p>
            <p className="text-sm">{f.ubicacion ?? "Sin ubicación"} · {f.areaHa ?? "—"} ha · {f.lotes} lote(s)</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {ctx.permisos.has("finca:administrar") && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nueva finca</summary>
            <div className="mt-3"><FormularioFinca /></div>
          </details>
        )}
        {ctx.permisos.has("lote:administrar") && (
          <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo lote</summary>
            <div className="mt-3"><FormularioLote fincas={datos.fincas} /></div>
          </details>
        )}
      </div>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {datos.lotes.map((l) => (
          <li key={l.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
            <p className="font-bold">{l.codigo} · {l.nombre}</p>
            <p className="text-sm">{l.fincaNombre} · {l.variedad ?? "Sin variedad"} · {l.areaHa ?? "—"} ha</p>
            <p className="mt-1 text-sm">Cosechado en total: <strong>{cantidad(l.cosechadoKg)} kg</strong></p>
          </li>
        ))}
      </ul>
    </section>
  );
}
