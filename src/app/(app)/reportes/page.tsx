import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Reportes · Gestión de Finca Cafetera" };

const REPORTES = [
  { tipo: "ventas", titulo: "Ventas", permiso: "venta:ver" },
  { tipo: "inventario", titulo: "Existencias por lote", permiso: "inventario:ver" },
  { tipo: "cosechas", titulo: "Cosechas", permiso: "cosecha:ver" },
  { tipo: "liquidaciones", titulo: "Liquidaciones de trabajadores", permiso: "liquidacion:ver" },
  { tipo: "conciliacion", titulo: "Conciliación interna (mes actual)", permiso: "finanzas:ver" },
  { tipo: "auditoria", titulo: "Auditoría (últimos 100 registros)", permiso: "auditoria:ver" },
];

export default async function Reportes() {
  const ctx = await exigirContexto();
  const visibles = REPORTES.filter((r) => ctx.permisos.has("reporte:ver") && ctx.permisos.has(r.permiso));
  return (
    <section className="space-y-4">
      <EncabezadoModulo titulo="Reportes" detalle="Archivos CSV generados en el servidor, solo con los datos de sus fincas. La exportación en PDF queda como trabajo futuro." />
      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borde bg-white p-5 text-sm text-suave">Su rol no tiene reportes disponibles.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visibles.map((r) => (
            <li key={r.tipo} className="rounded-xl border border-borde shadow-sm bg-white p-3">
              <p className="font-bold">{r.titulo}</p>
              <a href={`/api/reportes/${r.tipo}`} download className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-bosque px-5 text-sm font-semibold text-white shadow-sm hover:bg-bosque/90">Descargar CSV</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
