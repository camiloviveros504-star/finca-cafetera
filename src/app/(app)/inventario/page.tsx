import { consultarSaldos, ErrorProhibido, servicios } from "@/composicion";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Inventario · Gestión de Finca Cafetera" };

export default async function Inventario() {
  const ctx = await exigirContexto();
  let filas;
  try {
    filas = await consultarSaldos(servicios().inventario, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert">No tiene permiso para consultar el inventario.</p>;
    throw error;
  }
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Inventario</h1>
      <p className="mb-4 text-sm">Existencias por finca, producto y lote de origen. Son una proyección de los movimientos.</p>
      {filas.length === 0 ? (
        <p className="rounded-lg bg-arena p-4">Aún no hay existencias registradas.</p>
      ) : (
        <>
          {/* Tarjetas en celular */}
          <ul className="space-y-3 md:hidden">
            {filas.map((f) => (
              <li key={f.saldoId} className="rounded-xl border-2 border-tinta/20 bg-white p-3">
                <p className="font-bold">{f.productoNombre}</p>
                <p className="text-sm">
                  {f.fincaNombre} · {f.bodegaNombre} · Lote {f.loteCodigo}
                </p>
                <p className="mt-1 text-lg font-extrabold">{cantidad(f.cantidad)} kg</p>
              </li>
            ))}
          </ul>
          {/* Tabla desde md; solo la tabla se desplaza si no cabe */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Existencias de inventario</caption>
              <thead className="bg-tinta text-white">
                <tr>
                  <th scope="col" className="p-3">Finca</th>
                  <th scope="col" className="p-3">Bodega</th>
                  <th scope="col" className="p-3">Producto</th>
                  <th scope="col" className="p-3">Lote</th>
                  <th scope="col" className="p-3 text-right">Cantidad (kg)</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.saldoId} className="border-b border-tinta/15 bg-white">
                    <td className="p-3">{f.fincaNombre}</td>
                    <td className="p-3">{f.bodegaNombre}</td>
                    <td className="p-3">{f.productoNombre}</td>
                    <td className="p-3">{f.loteCodigo}</td>
                    <td className="p-3 text-right font-bold">{cantidad(f.cantidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
