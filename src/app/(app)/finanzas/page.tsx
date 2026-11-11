import { ErrorProhibido, ErrorValidacion, listarFincasYLotes, listarGastos, obtenerConciliacion, obtenerResumenFinanciero, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionRegistrarGasto } from "./acciones";

export const metadata = { title: "Finanzas · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

function Tarjeta({ titulo, valor, negativo }: { titulo: string; valor: string; negativo?: boolean }) {
  return (
    <div className="rounded-xl border-2 border-tinta/20 bg-white p-3">
      <p className="text-sm font-semibold">{titulo}</p>
      <p className={`text-xl font-extrabold ${negativo || Number(valor) < 0 ? "text-alerta" : ""}`}>{moneda(valor)}</p>
    </div>
  );
}

export default async function Finanzas({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const ctx = await exigirContexto();
  const q = await searchParams;
  const fin = hoy();
  const desde = q.desde ?? `${fin.slice(0, 8)}01`;
  const hasta = q.hasta ?? fin;
  let resumen;
  let conciliacion;
  try {
    resumen = await obtenerResumenFinanciero(servicios().finanzas, ctx, desde, hasta);
    conciliacion = await obtenerConciliacion(servicios().finanzas, ctx, desde, hasta);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar las finanzas.</p>;
    if (error instanceof ErrorValidacion) return <p role="alert" className="font-semibold text-alerta">{error.message}</p>;
    throw error;
  }
  const gastos = ctx.permisos.has("gasto:ver") ? await listarGastos(servicios().finanzas, ctx, desde, hasta) : [];
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).catch(() => ({ fincas: [], lotes: [] }));
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Finanzas" detalle="Resumen de gestión (base devengada) y conciliación interna. No es contabilidad oficial ni facturación electrónica." />
      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Desde<input type="date" name="desde" defaultValue={desde} className="mt-1 block min-h-11 rounded-lg border-2 border-tinta/40 px-3" /></label>
        <label className="text-sm font-semibold">Hasta<input type="date" name="hasta" defaultValue={hasta} className="mt-1 block min-h-11 rounded-lg border-2 border-tinta/40 px-3" /></label>
        <button className="min-h-11 rounded-lg bg-bosque px-4 font-bold text-white">Consultar</button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta titulo="Ingresos por ventas" valor={resumen.ingresosVentas} />
        <Tarjeta titulo="Cobrado en el período" valor={resumen.cobrado} />
        <Tarjeta titulo="Cartera por cobrar" valor={resumen.cuentasPorCobrar} />
        <Tarjeta titulo="Resultado (devengado)" valor={resumen.resultadoDevengado} />
        <Tarjeta titulo="Costos de producción" valor={resumen.costosProduccion} />
        <Tarjeta titulo="Mano de obra liquidada" valor={resumen.manoObraLiquidada} />
        <Tarjeta titulo="Compras recibidas" valor={resumen.comprasRecibidas} />
        <Tarjeta titulo="Gastos (agrícolas + admin.)" valor={String(Number(resumen.gastosAgricolas) + Number(resumen.gastosAdministrativos))} />
        <Tarjeta titulo="Por pagar a proveedores" valor={resumen.cuentasPorPagarProveedores} />
        <Tarjeta titulo="Por pagar a trabajadores" valor={resumen.cuentasPorPagarTrabajadores} />
        <Tarjeta titulo="Flujo de caja del período" valor={resumen.flujoDeCaja} />
      </div>

      {ctx.permisos.has("gasto:registrar") && (
        <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Registrar gasto</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionRegistrarGasto} boton="Registrar gasto" conClave campos={[
              { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas.fincas.map((f) => ({ valor: f.id, texto: f.nombre })) },
              { nombre: "loteId", etiqueta: "Lote (opcional)", tipo: "select", opciones: [{ valor: "", texto: "Sin lote" }, ...fincas.lotes.map((l) => ({ valor: l.id, texto: `${l.fincaNombre} · ${l.codigo}` }))] },
              { nombre: "clasificacion", etiqueta: "Clasificación", tipo: "select", opciones: [{ valor: "agricola", texto: "Agrícola" }, { valor: "administrativo", texto: "Administrativo" }] },
              { nombre: "tipo", etiqueta: "Tipo de gasto", tipo: "select", opciones: [["insumos", "Insumos agrícolas"], ["mano_obra", "Mano de obra"], ["administrativo", "Gasto administrativo"], ["mantenimiento", "Mantenimiento"], ["combustible", "Combustible"]].map(([valor, texto]) => ({ valor, texto })) },
              { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: fin },
              { nombre: "monto", etiqueta: "Monto (COP)", tipo: "number", requerido: true },
              { nombre: "metodo", etiqueta: "Método de pago", tipo: "select", opciones: [{ valor: "efectivo", texto: "Efectivo" }, { valor: "transferencia", texto: "Transferencia" }] },
              { nombre: "descripcion", etiqueta: "Descripción", requerido: true },
            ]} />
          </div>
        </details>
      )}

      <h2 className="text-xl font-extrabold">Conciliación interna</h2>
      <p className="text-sm">Entradas {moneda(conciliacion.totalEntradas)} · Salidas {moneda(conciliacion.totalSalidas)} · Neto <strong>{moneda(conciliacion.neto)}</strong></p>
      <ul className="grid gap-2 md:grid-cols-2">
        {conciliacion.porMetodo.map((m) => <li key={m.metodo} className="rounded-xl border-2 border-tinta/20 bg-white p-3 text-sm"><strong>{m.metodo}</strong>: entradas {moneda(m.entradas)} · salidas {moneda(m.salidas)} · neto {moneda(m.neto)}</li>)}
      </ul>
      <ul className="space-y-1 text-sm">
        {conciliacion.movimientos.map((m, i) => (
          <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-3 py-2">
            <span>{m.fecha} · {m.concepto} · {m.tercero} · {m.metodo}</span>
            <strong className={Number(m.salida) > 0 ? "text-alerta" : "text-bosque"}>{Number(m.salida) > 0 ? `− ${moneda(m.salida)}` : `+ ${moneda(m.entrada)}`}</strong>
          </li>
        ))}
      </ul>

      {gastos.length > 0 && (
        <>
          <h2 className="text-xl font-extrabold">Gastos del período</h2>
          <ul className="space-y-1 text-sm">{gastos.map((g) => <li key={g.id} className="rounded-lg bg-white px-3 py-2">{g.fecha} · {g.fincaNombre}{g.loteCodigo ? ` · ${g.loteCodigo}` : ""} · {g.tipo} ({g.clasificacion}) · {g.descripcion} · <strong>{moneda(g.monto)}</strong></li>)}</ul>
        </>
      )}
    </section>
  );
}
