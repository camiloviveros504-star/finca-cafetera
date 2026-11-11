import Link from "next/link";
import { redirect } from "next/navigation";
import { listarFincasYLotes, obtenerPanel, servicios } from "@/composicion";
import { Icono, type NombreIcono } from "../../_componentes/Icono";
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
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function Indicador({ titulo, valor, nota, icono, tono = "normal" }: { titulo: string; valor: string; nota?: string; icono: NombreIcono; tono?: "normal" | "positivo" | "negativo" }) {
  const color = tono === "positivo" ? "text-bosque" : tono === "negativo" ? "text-alerta" : "text-tinta";
  return (
    <li className="rounded-xl border border-borde bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-suave sm:text-sm">{titulo}</p>
        <span className="hidden size-8 shrink-0 items-center sm:flex justify-center rounded-lg bg-bosque-claro text-bosque"><Icono nombre={icono} className="size-4" /></span>
      </div>
      <p className={`mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${color}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-suave">{nota}</p>}
    </li>
  );
}

function Panel({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borde bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-4 text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

/** Barras horizontales: para comparar lotes o tipos de café. */
function BarrasHorizontales({ datos, etiqueta }: { datos: { clave: string; texto: string; valor: number }[]; etiqueta: string }) {
  const maximo = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <ul className="space-y-3" aria-label={etiqueta}>
      {datos.map((d) => (
        <li key={d.clave}>
          <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate text-tinta/85">{d.texto}</span><span className="font-semibold tabular-nums">{cantidad(d.valor)} kg</span></div>
          <div className="mt-1.5 h-2 rounded-full bg-fondo" role="img" aria-label={`${d.texto}: ${cantidad(d.valor)} kg`}>
            <div className="h-2 rounded-full bg-bosque" style={{ width: `${d.valor > 0 ? Math.max((d.valor / maximo) * 100, 2) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Columnas por mes: muestra la estacionalidad de la cosecha de un vistazo. */
function ColumnasPorMes({ datos }: { datos: { mes: string; kg: number }[] }) {
  const maximo = Math.max(...datos.map((d) => d.kg), 1);
  return (
    <div>
      <ul className="flex h-40 items-end gap-1.5" aria-label="Kilos recolectados por mes">
        {datos.map((d) => (
          <li key={d.mes} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.mes}: ${cantidad(d.kg)} kg`}>
            <span className="sr-only">{`${MESES[Number(d.mes.slice(5)) - 1]} ${d.mes.slice(0, 4)}: ${cantidad(d.kg)} kg`}</span>
            <div className={`w-full rounded-t ${d.kg > 0 ? "bg-bosque" : "bg-fondo"}`} style={{ height: `${d.kg > 0 ? Math.max((d.kg / maximo) * 100, 3) : 3}%` }} />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1.5 text-center text-[10px] text-suave" aria-hidden>
        {datos.map((d) => <span key={d.mes} className="flex-1">{MESES[Number(d.mes.slice(5)) - 1]}</span>)}
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor, href, alerta }: { etiqueta: string; valor: string; href?: string; alerta?: boolean }) {
  const contenido = (
    <>
      <span className="text-tinta/85">{etiqueta}</span>
      <span className={`font-semibold tabular-nums ${alerta ? "text-alerta" : ""}`}>{valor}</span>
    </>
  );
  return (
    <li>
      {href ? <Link href={href} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-fondo">{contenido}</Link> : <div className="flex min-h-11 items-center justify-between gap-3 px-2 text-sm">{contenido}</div>}
    </li>
  );
}

export default async function Inicio() {
  const ctx = await exigirContexto();
  // Cada rol aterriza en su pantalla de trabajo; administrador, dueño y capataz ven el panel.
  const destino = DESTINO_POR_ROL.find(([rol]) => ctx.roles.includes(rol))?.[1];
  if (destino && !ctx.roles.some((r) => PANEL_PROPIO.includes(r))) redirect(destino);
  const panel = await obtenerPanel(servicios().panel, ctx);
  const mes = MESES_LARGOS[Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", month: "numeric" }).format(new Date())) - 1];

  const lotes = panel.recoleccionPorLote ?? [];
  const lotesConCafe = lotes.filter((l) => l.estado !== "Sin sembrar" || Number(l.kg) > 0);
  const variasFincas = new Set(lotes.map((l) => l.finca)).size > 1;
  const kgBodega = (panel.existencias ?? []).reduce((s, e) => s + Number(e.kg), 0);
  const porMes = (panel.recoleccionPorMes ?? []).map((m) => ({ mes: m.mes, kg: Number(m.kg) }));
  const hayCosechaAnual = porMes.some((m) => m.kg > 0);
  const b = panel.billeteraMes;

  const indicadores: { titulo: string; valor: string; nota?: string; icono: NombreIcono; tono?: "normal" | "positivo" | "negativo" }[] = panel.plataforma
    ? [
        { titulo: "Fincas", valor: String(panel.plataforma.fincas), nota: `${panel.plataforma.lotes} lotes · ${cantidad(panel.plataforma.hectareas)} ha`, icono: "finca" },
        { titulo: "Cuentas activas", valor: String(panel.plataforma.usuarios), nota: "Dueños, capataces y trabajadores", icono: "cuentas" },
        { titulo: "Recolectado este año", valor: `${cantidad(panel.plataforma.kgAnio)} kg`, nota: "Todas las fincas", icono: "recoleccion" },
        { titulo: "Café seco en bodega", valor: `${cantidad(panel.plataforma.kgSeco)} kg`, nota: "Pergamino seco, todas las fincas", icono: "bodega" },
      ]
    : [
        ...(panel.existencias ? [{ titulo: "Café en bodega", valor: `${cantidad(kgBodega)} kg`, nota: kgBodega > 0 ? `${panel.existencias.length} tipo(s) de café` : "Sin café en bodega", icono: "bodega" as const }] : []),
        ...(panel.cosechasMes ? [{ titulo: `Recolectado en ${mes}`, valor: `${cantidad(panel.cosechasMes.kg)} kg`, nota: panel.cosechasMes.cantidad > 0 ? `${panel.cosechasMes.cantidad} registro(s)` : "Aún sin recolección este mes", icono: "recoleccion" as const }] : []),
        ...(panel.ventasMes ? [{ titulo: `Vendido en ${mes}`, valor: moneda(panel.ventasMes.total), nota: panel.ventasMes.cantidad > 0 ? `${panel.ventasMes.cantidad} venta(s)` : "Aún sin ventas este mes", icono: "venta" as const }] : []),
        ...(b ? [{ titulo: `Billetera de ${mes}`, valor: moneda(b.saldo), nota: `Entró ${moneda(b.entradas)} · salió ${moneda(b.salidas)}`, icono: "billetera" as const, tono: (Number(b.saldo) < 0 ? "negativo" : Number(b.saldo) > 0 ? "positivo" : "normal") as "normal" | "positivo" | "negativo" }] : []),
      ];

  const pendientes = [
    panel.porCobrar && { etiqueta: `Le deben compradores (${panel.porCobrar.ventas} venta${panel.porCobrar.ventas === 1 ? "" : "s"})`, monto: Number(panel.porCobrar.total), valor: moneda(panel.porCobrar.total), href: "/cartera", alerta: Number(panel.porCobrar.total) > 0 },
    panel.porPagar && { etiqueta: "Debe a proveedores", monto: Number(panel.porPagar.proveedores), valor: moneda(panel.porPagar.proveedores), href: "/compras", alerta: Number(panel.porPagar.proveedores) > 0 },
    panel.porPagar && { etiqueta: "Debe a trabajadores", monto: Number(panel.porPagar.trabajadores), valor: moneda(panel.porPagar.trabajadores), href: "/liquidaciones", alerta: Number(panel.porPagar.trabajadores) > 0 },
    b && Number(b.fletes) > 0 && { etiqueta: `Fletes pagados en ${mes}`, monto: Number(b.fletes), valor: moneda(b.fletes), href: "/finanzas" },
  ].filter(Boolean) as { etiqueta: string; monto: number; valor: string; href?: string; alerta?: boolean }[];
  const pendientesConValor = pendientes.filter((p) => p.monto !== 0);

  const sinNada = !panel.plataforma && lotes.length === 0 && kgBodega === 0;
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const fechaTexto = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const fecha = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);
  const hectareas = fincas.reduce((t, f) => t + Number(f.areaHa ?? 0), 0);
  const lugar = panel.plataforma ? `${fincas.length} finca(s) en la plataforma` : fincas.length === 1 ? fincas[0].nombre : `${fincas.length} fincas`;
  const rol = ctx.roles.includes("administrador") ? "Administrador" : ctx.roles.includes("propietario") ? "Propietario" : ctx.roles.includes("capataz") ? "Capataz" : null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-[#0e1f18] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
        <div aria-hidden className="absolute -right-16 -top-24 size-72 rounded-full bg-[#1d4f3f]/70 blur-2xl" />
        <div aria-hidden className="absolute -bottom-28 right-32 size-64 rounded-full bg-[#2e6b55]/40 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm text-[#a9d5c2]">{fecha}{rol ? ` · ${rol}` : ""}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Hola, {ctx.nombre.split(" ")[0]}</h1>
            <p className="mt-1.5 text-sm text-white/75">{panel.plataforma ? "Así va la plataforma." : `Así va ${lugar} en ${mes}.`}</p>
          </div>
          {!panel.plataforma && (lotes.length > 0 || kgBodega > 0) && (
            <dl className="flex gap-6 text-right">
              <div><dt className="text-xs text-white/60">Lotes</dt><dd className="text-xl font-semibold tabular-nums">{lotes.length}</dd></div>
              <div><dt className="text-xs text-white/60">Con café</dt><dd className="text-xl font-semibold tabular-nums">{lotes.filter((l) => l.estado !== "Sin sembrar").length}</dd></div>
              {hectareas > 0 && <div><dt className="text-xs text-white/60">Hectáreas</dt><dd className="text-xl font-semibold tabular-nums">{cantidad(hectareas)}</dd></div>}
            </dl>
          )}
          {panel.plataforma && <p className="text-sm text-white/75">{lugar}</p>}
        </div>
      </section>

      {panel.plagasActivas && panel.plagasActivas.casos > 0 && (
        <Link href="/lotes" role="alert" className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium text-tinta ${panel.plagasActivas.altas > 0 ? "border-alerta/40 bg-alerta/5 hover:bg-alerta/10" : "border-ambar/40 bg-ambar/5 hover:bg-ambar/10"}`}>
          <Icono nombre="alerta" className={`size-5 shrink-0 ${panel.plagasActivas.altas > 0 ? "text-alerta" : "text-ambar"}`} />
          {panel.plagasActivas.lotes} lote(s) con plagas o enfermedades sin controlar{panel.plagasActivas.altas > 0 ? `, ${panel.plagasActivas.altas} de severidad alta` : ""}. Vea el tratamiento en Lotes.
        </Link>
      )}

      {(panel.insumosPorVencer ?? 0) > 0 && (
        <Link href="/sanidad" role="alert" className="flex items-center gap-3 rounded-xl border border-ambar/40 bg-ambar/5 p-4 text-sm font-medium text-tinta hover:bg-ambar/10">
          <Icono nombre="alerta" className="size-5 shrink-0 text-ambar" />
          {panel.insumosPorVencer} insumo(s) vencidos o que vencen en menos de 30 días. Revíselos antes de aplicarlos.
        </Link>
      )}

      {sinNada && (
        <section className="rounded-xl border border-dashed border-borde bg-white p-5">
          <h2 className="font-semibold">Empiece en tres pasos</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Registre sus lotes", "Hectáreas, si están sembrados y desde cuándo.", "/lotes"],
              ["2", "Agregue a su equipo", "Trabajadores y capataz, con cómo se les paga.", "/trabajadores"],
              ["3", "Anote cada recolección", "Kilos por lote y por trabajador; el resto se calcula solo.", "/cosechas"],
            ].map(([n, t, d, href]) => (
              <li key={n}>
                <Link href={href} className="flex h-full gap-3 rounded-lg border border-borde p-4 hover:border-bosque/40 hover:bg-bosque-claro/40">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bosque text-sm font-semibold text-white">{n}</span>
                  <span><span className="block text-sm font-semibold">{t}</span><span className="text-sm text-suave">{d}</span></span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {indicadores.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Indicadores">
          {indicadores.map((k) => <Indicador key={k.titulo} {...k} />)}
        </ul>
      )}

      {(hayCosechaAnual || pendientes.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {hayCosechaAnual && (
            <Panel titulo="Recolección de los últimos 12 meses" className={pendientes.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
              <ColumnasPorMes datos={porMes} />
            </Panel>
          )}
          {pendientes.length > 0 && (
            <Panel titulo="Pendientes de dinero" className={hayCosechaAnual ? "" : "lg:col-span-3"}>
              {pendientesConValor.length > 0 ? <ul className="-mx-2 divide-y divide-borde">{pendientesConValor.map((p) => <Fila key={p.etiqueta} etiqueta={p.etiqueta} valor={p.valor} href={p.href} alerta={p.alerta} />)}</ul> : <p className="text-sm text-suave">{panel.plataforma ? "Ninguna finca tiene saldos pendientes." : "Está al día: no le deben ni debe nada."}</p>}
            </Panel>
          )}
        </div>
      )}

      {(lotesConCafe.some((l) => Number(l.kg) > 0) || (panel.existencias ?? []).length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {lotesConCafe.some((l) => Number(l.kg) > 0) && (
            <Panel titulo="Recolección del año por lote">
              <BarrasHorizontales etiqueta="Kilos por lote" datos={lotesConCafe.map((l) => ({ clave: l.finca + l.lote, texto: `${l.lote} · ${l.estado}${variasFincas ? ` · ${l.finca}` : ""}`, valor: Number(l.kg) }))} />
            </Panel>
          )}
          {(panel.existencias ?? []).length > 0 && (
            <Panel titulo="Café en bodega por tipo">
              <BarrasHorizontales etiqueta="Existencias por tipo de café" datos={panel.existencias!.map((e) => ({ clave: e.producto, texto: e.producto, valor: Number(e.kg) }))} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
