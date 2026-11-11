import Link from "next/link";
import { consultarTrazabilidadVenta, ErrorNoEncontrado, ErrorProhibido, servicios } from "@/composicion";
import { cantidad, fechaHora } from "../../../_servidor/formatos";
import { exigirContexto } from "../../../_servidor/sesion";

export const metadata = { title: "Trazabilidad · Gestión de Finca Cafetera" };

export default async function Trazabilidad({ params }: { params: Promise<{ ventaId: string }> }) {
  const ctx = await exigirContexto();
  const { ventaId } = await params;
  try {
    const t = await consultarTrazabilidadVenta(servicios().trazabilidad, ctx, ventaId);
    return (
      <section>
        <Link href="/ventas" className="text-sm font-bold underline">← Ventas</Link>
        <h1 className="mt-2 text-2xl font-extrabold">Trazabilidad · comprobante {t.numeroComprobante}</h1>
        <p className="mb-4 text-sm">{t.cliente} · {fechaHora(t.fecha)}</p>
        <ol className="space-y-4">
          {t.lineas.map((l) => (
            <li key={l.movimientoId} className="rounded-xl border-2 border-tinta/20 bg-white p-4">
              <p className="text-lg font-extrabold">{l.producto} · {cantidad(l.cantidadVendida)} kg</p>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold">Lote de origen</dt>
                  <dd>{l.loteCodigo} · {l.loteNombre} ({l.fincaNombre})</dd>
                </div>
                <div>
                  <dt className="font-bold">Transformaciones</dt>
                  <dd>
                    {l.transformaciones.length === 0
                      ? "Sin transformaciones registradas"
                      : l.transformaciones.map((x) => `${x.productoEntrada} → ${x.productoSalida} (${x.fecha})`).join("; ")}
                  </dd>
                </div>
              </dl>
              <h2 className="mt-3 text-sm font-bold">Cosechas del lote hasta la fecha de la venta</h2>
              {l.cosechas.length === 0 ? (
                <p className="text-sm">No hay cosechas registradas para este lote.</p>
              ) : (
                <ul className="mt-1 list-inside list-disc text-sm">
                  {l.cosechas.map((c) => (
                    <li key={c.cosechaId}>{c.fecha} · {cantidad(c.cantidad)} {c.unidad}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs">La trazabilidad es por lote: se muestran las cosechas del lote de origen hasta la fecha de la venta.</p>
      </section>
    );
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar la trazabilidad.</p>;
    if (error instanceof ErrorNoEncontrado) return <p role="alert" className="font-semibold">Venta no encontrada.</p>;
    throw error;
  }
}
