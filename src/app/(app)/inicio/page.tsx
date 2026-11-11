import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerPanel, servicios } from "@/composicion";
import { cantidad, moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Inicio · Gestión de Finca Cafetera" };

const PANEL_PROPIO = ["administrador", "encargado_produccion", "responsable_comercial"];
const DESTINO_POR_ROL: [string, string][] = [
  ["recolector", "/trabajo"],
  ["supervisor_campo", "/trabajo"],
  ["responsable_financiero", "/finanzas"],
  ["responsable_bodega", "/inventario"],
  ["auditor", "/auditoria"],
];

export default async function Inicio() {
  const ctx = await exigirContexto();
  // Cada rol aterriza en su pantalla de trabajo; administrador, producción y comercial ven el panel.
  const destino = DESTINO_POR_ROL.find(([rol]) => ctx.roles.includes(rol))?.[1];
  if (destino && !ctx.roles.some((r) => PANEL_PROPIO.includes(r))) redirect(destino);
  const panel = await obtenerPanel(servicios().panel, ctx);
  const accesos = [
    { href: "/cosechas/nueva", texto: "Registrar cosecha", permiso: "cosecha:registrar" },
    { href: "/ventas/nueva", texto: "Registrar venta", permiso: "venta:crear" },
    { href: "/inventario", texto: "Consultar inventario", permiso: "inventario:ver" },
    { href: "/ventas", texto: "Ver ventas y trazabilidad", permiso: "venta:ver" },
  ].filter((a) => ctx.permisos.has(a.permiso));
  const maximo = Math.max(...(panel.existencias ?? []).map((e) => Number(e.kg)), 1);
  const kpis = [
    panel.existencias && { t: "Existencias totales", v: `${cantidad(panel.existencias.reduce((s, e) => s + Number(e.kg), 0))} kg` },
    panel.ventas30d && { t: "Ventas (30 días)", v: `${panel.ventas30d.cantidad} · ${moneda(panel.ventas30d.total)}` },
    panel.cosechas30d && { t: "Cosechado (30 días)", v: `${cantidad(panel.cosechas30d.kg)} kg` },
    panel.cosechas30d && { t: "Cosechas registradas", v: String(panel.cosechas30d.cantidad) },
  ].filter(Boolean) as { t: string; v: string }[];
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Hola, {ctx.nombre}</h1>
        <p className="text-sm">Resumen de las fincas a las que tiene acceso.</p>
      </div>
      {kpis.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores">
          {kpis.map((k) => (
            <li key={k.t} className="rounded-xl border-2 border-tinta/20 bg-white p-4">
              <p className="text-sm font-bold">{k.t}</p>
              <p className="mt-1 text-2xl font-extrabold">{k.v}</p>
            </li>
          ))}
        </ul>
      )}
      {panel.existencias && panel.existencias.length > 0 && (
        <figure className="rounded-xl border-2 border-tinta/20 bg-white p-4">
          <figcaption className="mb-3 font-extrabold">Existencias por producto (kg)</figcaption>
          <ul className="space-y-3">
            {panel.existencias.map((e) => (
              <li key={e.producto}>
                <div className="flex justify-between text-sm"><span>{e.producto}</span><strong>{cantidad(e.kg)}</strong></div>
                <div className="mt-1 h-4 rounded bg-arena" role="img" aria-label={`${e.producto}: ${cantidad(e.kg)} kg`}>
                  <div className="h-4 rounded bg-bosque" style={{ width: `${Math.max((Number(e.kg) / maximo) * 100, 2)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </figure>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {accesos.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="flex min-h-16 items-center rounded-xl border-2 border-tinta/20 bg-white p-4 text-base font-bold hover:border-bosque">
              {a.texto}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
