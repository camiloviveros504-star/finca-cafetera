import Link from "next/link";
import { ErrorProhibido, listarVentas, servicios } from "@/composicion";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { fechaHora, moneda } from "../../_servidor/formatos";
import { accionAnularVenta } from "./acciones";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Ventas · Gestión de Finca Cafetera" };

export default async function Ventas({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const ctx = await exigirContexto();
  const pagina = Math.max(Number((await searchParams).pagina ?? 1) || 1, 1);
  let datos;
  try {
    datos = await listarVentas(servicios().comercial, ctx, pagina);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar ventas.</p>;
    throw error;
  }
  const paginas = Math.max(Math.ceil(datos.total / 25), 1);
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Ventas</h1>
        {ctx.permisos.has("venta:crear") && (
          <Link href="/ventas/nueva" className="flex min-h-11 items-center rounded-lg bg-bosque px-4 font-bold text-white">
            Registrar venta
          </Link>
        )}
      </div>
      {datos.filas.length === 0 ? (
        <p className="rounded-lg bg-arena p-4">Todavía no hay ventas registradas.</p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {datos.filas.map((v) => (
              <li key={v.id} className="rounded-xl border-2 border-tinta/20 bg-white p-3">
                <p className="font-bold">Comprobante {v.numeroComprobante} · {moneda(v.total)}{v.estado === "anulada" ? " · ANULADA" : ""}</p>
                <p className="text-sm">{v.clienteNombre} · {v.fincaNombre}</p>
                <p className="text-xs">{fechaHora(v.fecha)}</p>
                {ctx.permisos.has("trazabilidad:ver") && (
                  <Link href={`/trazabilidad/${v.id}`} className="mt-2 inline-flex min-h-11 items-center font-bold text-bosque underline">
                    Ver trazabilidad
                  </Link>
                )}
                {ctx.permisos.has("venta:anular") && v.estado === "confirmada" && (
                  <details className="mt-2"><summary className="min-h-11 cursor-pointer font-semibold text-alerta">Anular</summary>
                    <FormularioGenerico compacto accion={accionAnularVenta} boton="Confirmar anulación" ocultos={{ ventaId: v.id }} campos={[{ nombre: "motivo", etiqueta: "Motivo (mínimo 10 caracteres)", requerido: true }]} />
                  </details>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Ventas registradas</caption>
              <thead className="bg-tinta text-white">
                <tr>
                  <th scope="col" className="p-3">N.º</th>
                  <th scope="col" className="p-3">Fecha</th>
                  <th scope="col" className="p-3">Cliente</th>
                  <th scope="col" className="hidden p-3 lg:table-cell">Finca</th>
                  <th scope="col" className="p-3 text-right">Total</th>
                  <th scope="col" className="p-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {datos.filas.map((v) => (
                  <tr key={v.id} className="border-b border-tinta/15 bg-white">
                    <td className="p-3">{v.numeroComprobante}{v.estado === "anulada" ? " (anulada)" : ""}</td>
                    <td className="p-3">{fechaHora(v.fecha)}</td>
                    <td className="p-3">{v.clienteNombre}</td>
                    <td className="hidden p-3 lg:table-cell">{v.fincaNombre}</td>
                    <td className="p-3 text-right font-bold">{moneda(v.total)}</td>
                    <td className="p-3">
                      {ctx.permisos.has("trazabilidad:ver") && (
                        <Link href={`/trazabilidad/${v.id}`} className="font-bold text-bosque underline">Trazabilidad</Link>
                      )}
                      {ctx.permisos.has("venta:anular") && v.estado === "confirmada" && (
                        <details className="mt-1"><summary className="cursor-pointer font-semibold text-alerta">Anular</summary>
                          <FormularioGenerico compacto accion={accionAnularVenta} boton="Confirmar" ocultos={{ ventaId: v.id }} campos={[{ nombre: "motivo", etiqueta: "Motivo (mín. 10)", requerido: true }]} />
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
        {pagina > 1 ? <Link className="min-h-11 py-3 font-bold underline" href={`/ventas?pagina=${pagina - 1}`}>← Anterior</Link> : <span />}
        <span>Página {pagina} de {paginas}</span>
        {pagina < paginas ? <Link className="min-h-11 py-3 font-bold underline" href={`/ventas?pagina=${pagina + 1}`}>Siguiente →</Link> : <span />}
      </nav>
    </section>
  );
}
