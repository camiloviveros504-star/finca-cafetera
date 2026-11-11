import { ErrorProhibido, listarPedidos, obtenerOpcionesVenta, servicios } from "@/composicion";
import { exigirContexto } from "../../_servidor/sesion";
import { FormularioPedido } from "./FormularioPedido";

export const metadata = { title: "Pedidos · Gestión de Finca Cafetera" };

export default async function Pedidos() {
  const ctx = await exigirContexto();
  let datos;
  let opciones = null;
  try {
    datos = await listarPedidos(servicios().clientes, ctx, 1);
    if (ctx.permisos.has("pedido:crear") && ctx.permisos.has("venta:crear")) opciones = await obtenerOpcionesVenta(servicios().comercial, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar pedidos.</p>;
    throw error;
  }
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-extrabold">Pedidos</h1>
      {opciones && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo pedido</summary>
          <div className="mt-3"><FormularioPedido {...opciones} /></div>
        </details>
      )}
      {datos.filas.length === 0 ? (
        <p className="rounded-lg bg-pergamino p-4">Todavía no hay pedidos.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {datos.filas.map((p) => (
            <li key={p.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
              <p className="font-bold">{p.clienteNombre} · <span className="uppercase">{p.estado}</span></p>
              <p className="text-sm">{p.resumen}</p>
              <p className="text-xs">{p.fecha} · {p.fincaNombre}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
