import { ErrorProhibido, listarMovimientos, obtenerOpcionesRegistro, servicios } from "@/composicion";
import { cantidad, fechaHora } from "../../../_servidor/formatos";
import { exigirContexto } from "../../../_servidor/sesion";
import { BotonReverso, FormularioAjuste, FormularioTransformacion, FormularioTraslado } from "./Formularios";

export const metadata = { title: "Operaciones de inventario · Gestión de Finca Cafetera" };

export default async function Operaciones() {
  const ctx = await exigirContexto();
  let movimientos;
  let opciones;
  try {
    movimientos = await listarMovimientos(servicios().operaciones, ctx, 1);
    opciones = ["inventario:ajustar", "inventario:transformar", "inventario:trasladar", "cosecha:registrar"].some((x) => ctx.permisos.has(x)) ? await obtenerOpcionesRegistro(servicios().produccion, ctx) : null;
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para ver los movimientos.</p>;
    throw error;
  }
  const puede = (p: string) => ctx.permisos.has(p);
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Operaciones de inventario</h1>
        <p className="text-sm">Los movimientos confirmados no se editan ni se borran: se corrigen con un reverso auditado.</p>
      </div>
      {opciones && (
        <div className="grid gap-4 xl:grid-cols-3">
          {puede("inventario:ajustar") && (
            <details className="rounded-xl border-2 border-tinta/20 bg-white p-4" open>
              <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Pérdida o ajuste</summary>
              <div className="mt-3"><FormularioAjuste o={opciones} /></div>
            </details>
          )}
          {puede("inventario:transformar") && (
            <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
              <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Transformación</summary>
              <div className="mt-3"><FormularioTransformacion o={opciones} /></div>
            </details>
          )}
          {puede("inventario:trasladar") && (
            <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
              <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Traslado entre bodegas</summary>
              <div className="mt-3"><FormularioTraslado o={opciones} /></div>
            </details>
          )}
        </div>
      )}
      <div>
        <h2 className="mb-2 text-lg font-extrabold">Últimos movimientos</h2>
        <ul className="space-y-2">
          {movimientos.filas.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-tinta/20 bg-white p-3 text-sm">
              <span>
                <strong>{m.tipo.replaceAll("_", " ")}</strong> · {m.producto} · lote {m.lote} · {m.bodega}
                <span className="block text-xs">{fechaHora(m.fecha)}{m.nota ? ` · ${m.nota}` : ""}</span>
              </span>
              <span className="flex flex-wrap items-center gap-3">
                <strong className={Number(m.delta) < 0 ? "text-alerta" : "text-bosque"}>{Number(m.delta) > 0 ? "+" : ""}{cantidad(m.delta)} kg</strong>
                {m.reversible && puede("inventario:reversar") && <BotonReverso movimientoId={m.id} />}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
