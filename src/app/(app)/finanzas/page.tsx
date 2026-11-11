import { ErrorProhibido, ErrorValidacion, listarFincasYLotes, obtenerConciliacion, obtenerResumenFinanciero, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { estiloCampo, FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionRegistrarGasto } from "./acciones";

export const metadata = { title: "Billetera · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

const TIPOS_GASTO = [
  ["flete", "Flete (transporte de café)"], ["jornales", "Jornales y mano de obra"], ["fertilizacion", "Fertilización"], ["fumigacion", "Fumigación"],
  ["insumos", "Insumos agrícolas"], ["combustible", "Combustible"], ["mantenimiento", "Mantenimiento"], ["servicios", "Servicios y otros pagos"], ["administrativo", "Gasto administrativo"],
].map(([valor, texto]) => ({ valor, texto }));

function Cifra({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "entra" | "sale" | "saldo" }) {
  const color = tono === "entra" ? "text-bosque" : tono === "sale" ? "text-alerta" : Number(valor) < 0 ? "text-alerta" : "text-tinta";
  return (
    <div className="rounded-xl border border-borde bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-suave">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${color}`}>{tono === "sale" && Number(valor) > 0 ? "− " : ""}{moneda(valor)}</p>
    </div>
  );
}

export default async function Billetera({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const ctx = await exigirContexto();
  const q = await searchParams;
  const fin = hoy();
  const desde = q.desde ?? `${fin.slice(0, 8)}01`;
  const hasta = q.hasta ?? fin;
  let resumen;
  let mov;
  try {
    resumen = await obtenerResumenFinanciero(servicios().finanzas, ctx, desde, hasta);
    mov = await obtenerConciliacion(servicios().finanzas, ctx, desde, hasta);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar la billetera.</p>;
    if (error instanceof ErrorValidacion) return <p role="alert" className="font-semibold text-alerta">{error.message}</p>;
    throw error;
  }
  const { fincas, lotes } = await listarFincasYLotes(servicios().fincasLotes, ctx).catch(() => ({ fincas: [], lotes: [] }));
  const movimientos = [...mov.movimientos].reverse(); // lo más reciente primero
  return (
    <div className="space-y-6">
      <EncabezadoModulo
        titulo="Billetera"
        detalle="El dinero que entra y sale de su finca. Se llena sola: cobros de ventas, fletes, compras de insumos y pagos a trabajadores. Aquí también registra cualquier otro gasto."
        accion={
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-suave">Desde<input type="date" name="desde" defaultValue={desde} className={`${estiloCampo} mt-1 block min-h-10 w-auto text-sm`} /></label>
            <label className="text-xs font-medium text-suave">Hasta<input type="date" name="hasta" defaultValue={hasta} className={`${estiloCampo} mt-1 block min-h-10 w-auto text-sm`} /></label>
            <button className="min-h-10 rounded-lg border border-[#cdd3d0] bg-white px-4 text-sm font-semibold hover:bg-fondo">Ver</button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Cifra titulo="Entró" valor={mov.totalEntradas} tono="entra" />
        <Cifra titulo="Salió" valor={mov.totalSalidas} tono="sale" />
        <Cifra titulo="Saldo del período" valor={mov.neto} tono="saldo" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-xl border border-borde bg-white shadow-sm">
          <h2 className="border-b border-borde px-5 py-3 text-sm font-semibold">Movimientos</h2>
          {movimientos.length === 0 ? (
            <p className="p-5 text-sm text-suave">No hubo movimientos de dinero en este período.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {movimientos.map((m, i) => {
                const sale = Number(m.salida) > 0;
                return (
                  <li key={i} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.concepto}</p>
                      <p className="truncate text-xs text-suave">{m.fecha} · {m.tercero}{m.metodo && m.metodo !== "sin_metodo" ? ` · ${m.metodo}` : ""}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${sale ? "text-alerta" : "text-bosque"}`}>{sale ? `− ${moneda(m.salida)}` : `+ ${moneda(m.entrada)}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {ctx.permisos.has("gasto:registrar") && (
            <section className="rounded-xl border border-borde bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Registrar un gasto o pago</h2>
              <FormularioGenerico
                accion={accionRegistrarGasto}
                boton="Registrar"
                conClave
                ocultos={fincas.length === 1 ? { fincaId: fincas[0].id } : {}}
                campos={[
                  ...(fincas.length > 1 ? [{ nombre: "fincaId", etiqueta: "Finca", tipo: "select" as const, opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })), ancho: "completo" as const }] : []),
                  { nombre: "tipo", etiqueta: "¿En qué se gastó?", tipo: "select", opciones: TIPOS_GASTO, ancho: "completo" },
                  { nombre: "monto", etiqueta: "Valor (COP)", tipo: "number", requerido: true, ancho: "completo" },
                  { nombre: "descripcion", etiqueta: "Detalle", requerido: true, placeholder: "Ej.: flete a la cooperativa", ancho: "completo" },
                  { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: fin, ancho: "completo" },
                  { nombre: "conLote", etiqueta: "Es de un lote en particular", tipo: "checkbox" },
                  { nombre: "loteId", etiqueta: "Lote", tipo: "select", visibleSi: "conLote", ancho: "completo", opciones: lotes.map((l) => ({ valor: l.id, texto: fincas.length > 1 ? `${l.fincaNombre} · ${l.codigo} ${l.nombre}` : `${l.codigo} ${l.nombre}` })) },
                  { nombre: "metodo", etiqueta: "Cómo se pagó", tipo: "select", ancho: "completo", opciones: [{ valor: "efectivo", texto: "Efectivo" }, { valor: "transferencia", texto: "Transferencia" }] },
                ]}
              />
            </section>
          )}
          <details className="rounded-xl border border-borde bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold">Resultado del período</summary>
            <dl className="mt-3 divide-y divide-borde text-sm">
              {[
                ["Ventas del período", resumen.ingresosVentas],
                ["Cobrado", resumen.cobrado],
                ["Gastos", String(Number(resumen.gastosAgricolas) + Number(resumen.gastosAdministrativos))],
                ["Compras recibidas", resumen.comprasRecibidas],
                ["Mano de obra liquidada", resumen.manoObraLiquidada],
                ["Resultado (ventas menos costos)", resumen.resultadoDevengado],
                ["Le deben compradores", resumen.cuentasPorCobrar],
                ["Debe a proveedores", resumen.cuentasPorPagarProveedores],
                ["Debe a trabajadores", resumen.cuentasPorPagarTrabajadores],
              ].map(([t, v]) => (
                <div key={t} className="flex justify-between gap-3 py-2"><dt className="text-suave">{t}</dt><dd className={`font-semibold tabular-nums ${Number(v) < 0 ? "text-alerta" : ""}`}>{moneda(v)}</dd></div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-suave">Herramienta de gestión; no reemplaza la contabilidad oficial ni la facturación electrónica.</p>
          </details>
        </div>
      </div>
    </div>
  );
}
