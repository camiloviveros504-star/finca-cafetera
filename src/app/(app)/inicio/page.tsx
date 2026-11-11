import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerPanel, servicios } from "@/composicion";
import { cantidad, moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Inicio · Gestión de Finca Cafetera" };

const PANEL_PROPIO = ["administrador", "propietario", "capataz", "encargado_produccion", "responsable_comercial"];
const DESTINO_POR_ROL: [string, string][] = [
  ["trabajador", "/trabajadores"],
  ["recolector", "/trabajo"],
  ["supervisor_campo", "/trabajo"],
  ["responsable_financiero", "/finanzas"],
  ["responsable_bodega", "/inventario"],
  ["auditor", "/auditoria"],
];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function Barras({ datos, etiqueta }: { datos: { clave: string; texto: string; valor: number }[]; etiqueta: string }) {
  const maximo = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <ul className="space-y-2" aria-label={etiqueta}>
      {datos.map((d) => (
        <li key={d.clave}>
          <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate">{d.texto}</span><strong>{cantidad(d.valor)} kg</strong></div>
          <div className="mt-1 h-3 rounded bg-arena" role="img" aria-label={`${d.texto}: ${cantidad(d.valor)} kg`}>
            <div className="h-3 rounded bg-bosque" style={{ width: `${d.valor > 0 ? Math.max((d.valor / maximo) * 100, 2) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const Tarjeta = ({ titulo, valor, detalle, alerta }: { titulo: string; valor: string; detalle?: string; alerta?: boolean }) => (
  <li className={`rounded-xl border-2 bg-white p-4 ${alerta ? "border-alerta" : "border-tinta/20"}`}>
    <p className="text-sm font-bold">{titulo}</p>
    <p className="mt-1 text-2xl font-extrabold">{valor}</p>
    {detalle && <p className="text-xs">{detalle}</p>}
  </li>
);

export default async function Inicio() {
  const ctx = await exigirContexto();
  // Cada rol aterriza en su pantalla de trabajo; administrador, dueño y capataz ven el panel.
  const destino = DESTINO_POR_ROL.find(([rol]) => ctx.roles.includes(rol))?.[1];
  if (destino && !ctx.roles.some((r) => PANEL_PROPIO.includes(r))) redirect(destino);
  const panel = await obtenerPanel(servicios().panel, ctx);
  const esAdmin = ctx.roles.includes("administrador");
  const accesos = [
    { href: "/cosechas", texto: "Registrar recolección", permiso: "cosecha:registrar" },
    { href: "/ventas/nueva", texto: "Registrar venta de café", permiso: "venta:crear" },
    { href: "/lotes", texto: "Ver mis lotes", permiso: "lote:ver" },
    { href: "/sanidad", texto: "Insumos y abonadas", permiso: "agroquimico:ver" },
    { href: "/trabajo", texto: "Labores del día", permiso: "trabajo:validar" },
    { href: "/compras", texto: "Comprar insumos", permiso: "compra:crear" },
  ].filter((a) => ctx.permisos.has(a.permiso));
  const lotes = panel.recoleccionPorLote ?? [];
  const kgPorLote = lotes.filter((l) => l.estado !== "Sin sembrar" || Number(l.kg) > 0);
  const sinSembrar = lotes.filter((l) => l.estado === "Sin sembrar" && Number(l.kg) === 0).length;
  const variasFincas = new Set(lotes.map((l) => l.finca)).size > 1;
  const kgBodega = (panel.existencias ?? []).reduce((s, e) => s + Number(e.kg), 0);
  const tarjetas = [
    panel.plataforma && { t: "Fincas en la plataforma", v: String(panel.plataforma.fincas), d: `${panel.plataforma.lotes} lotes · ${cantidad(panel.plataforma.hectareas)} ha` },
    panel.plataforma && { t: "Cuentas activas", v: String(panel.plataforma.usuarios), d: "Dueños, capataces y trabajadores" },
    panel.plataforma && { t: "Café recolectado este año", v: `${cantidad(panel.plataforma.kgAnio)} kg`, d: `Café seco en bodega: ${cantidad(panel.plataforma.kgSeco)} kg` },
    !panel.plataforma && panel.existencias && { t: "Café en bodega", v: `${cantidad(kgBodega)} kg`, d: "Todos los tipos de café" },
    panel.cosechas30d && { t: "Recolectado (30 días)", v: `${cantidad(panel.cosechas30d.kg)} kg`, d: `${panel.cosechas30d.cantidad} registro(s)` },
    panel.ventas30d && { t: "Ventas (30 días)", v: moneda(panel.ventas30d.total), d: `${panel.ventas30d.cantidad} venta(s)` },
    panel.gastos30d && { t: "Gastos (30 días)", v: moneda(panel.gastos30d.total), d: `Fletes: ${moneda(panel.gastos30d.fletes)}` },
    panel.porCobrar && { t: "Por cobrar a compradores", v: moneda(panel.porCobrar.total), d: `${panel.porCobrar.ventas} venta(s) con saldo`, a: Number(panel.porCobrar.total) > 0 },
    panel.porPagar && { t: "Por pagar", v: moneda(Number(panel.porPagar.proveedores) + Number(panel.porPagar.trabajadores)), d: `Proveedores ${moneda(panel.porPagar.proveedores)} · trabajadores ${moneda(panel.porPagar.trabajadores)}` },
  ].filter(Boolean) as { t: string; v: string; d?: string; a?: boolean }[];
  const sinMovimiento = !esAdmin && kgPorLote.length === 0 && (panel.existencias ?? []).length === 0;
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Hola, {ctx.nombre}</h1>
        <p className="text-sm">{esAdmin ? "Resumen de toda la plataforma." : "Resumen de su finca."}</p>
      </div>

      {(panel.insumosPorVencer ?? 0) > 0 && (
        <p role="alert" className="rounded-xl border-2 border-alerta bg-white p-3 text-sm font-semibold text-alerta">
          Tiene {panel.insumosPorVencer} insumo(s) vencidos o que vencen en menos de 30 días. <Link href="/sanidad" className="underline">Revisar el inventario de insumos</Link>
        </p>
      )}

      {sinMovimiento && (
        <div className="rounded-xl border-2 border-dashed border-tinta/30 bg-white p-4 text-sm">
          <p className="font-extrabold">Empiece por aquí</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Cree sus lotes en <Link className="font-bold underline" href="/lotes">Lotes</Link>: hectáreas, si están sembrados y desde cuándo.</li>
            <li>Agregue a sus trabajadores en <Link className="font-bold underline" href="/trabajadores">Equipo</Link>.</li>
            <li>Registre sus insumos y compras, y anote cada recolección y cada venta: aquí verá el resumen.</li>
          </ol>
        </div>
      )}

      {tarjetas.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Indicadores">
          {tarjetas.map((k) => <Tarjeta key={k.t} titulo={k.t} valor={k.v} detalle={k.d} alerta={k.a} />)}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {kgPorLote.length > 0 && (
          <figure className="rounded-xl border-2 border-tinta/20 bg-white p-4">
            <figcaption className="mb-3 font-extrabold">Recolección del año por lote</figcaption>
            <Barras etiqueta="Kilos por lote" datos={kgPorLote.map((l) => ({ clave: l.finca + l.lote, texto: `${l.lote} (${l.estado})${variasFincas ? ` · ${l.finca}` : ""}`, valor: Number(l.kg) }))} />
            {sinSembrar > 0 && <p className="mt-2 text-xs">{sinSembrar} lote(s) sin sembrar no aparecen aquí.</p>}
          </figure>
        )}
        {panel.recoleccionPorMes && panel.recoleccionPorMes.some((m) => Number(m.kg) > 0) && (
          <figure className="rounded-xl border-2 border-tinta/20 bg-white p-4">
            <figcaption className="mb-3 font-extrabold">Recolección en los últimos 12 meses</figcaption>
            <Barras etiqueta="Kilos por mes" datos={panel.recoleccionPorMes.map((m) => ({ clave: m.mes, texto: `${MESES[Number(m.mes.slice(5)) - 1]} ${m.mes.slice(0, 4)}`, valor: Number(m.kg) }))} />
          </figure>
        )}
        {panel.existencias && panel.existencias.length > 0 && (
          <figure className="rounded-xl border-2 border-tinta/20 bg-white p-4">
            <figcaption className="mb-3 font-extrabold">Café en bodega por tipo</figcaption>
            <Barras etiqueta="Existencias por tipo de café" datos={panel.existencias.map((e) => ({ clave: e.producto, texto: e.producto, valor: Number(e.kg) }))} />
          </figure>
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
