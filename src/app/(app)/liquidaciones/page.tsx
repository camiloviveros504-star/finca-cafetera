import { ErrorProhibido, listarLiquidaciones, listarTrabajadores, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionLiquidar, accionPagarTrabajador } from "../trabajadores/acciones";

export const metadata = { title: "Liquidaciones · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Liquidaciones() {
  const ctx = await exigirContexto();
  let lista;
  try {
    lista = await listarLiquidaciones(servicios().talento, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar liquidaciones.</p>;
    throw error;
  }
  const liquida = ctx.permisos.has("liquidacion:crear");
  const paga = ctx.permisos.has("pago_trabajador:registrar");
  const trabajadores = liquida ? await listarTrabajadores(servicios().talento, ctx) : [];
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Liquidaciones y pagos" detalle="Liquidación interna de remuneraciones; no es nómina legal ni factura electrónica." />
      {liquida && (
        <details open className="rounded-xl border border-borde shadow-sm bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-base font-semibold">Liquidar un período</summary>
          <div className="mt-3">
            <FormularioGenerico
              accion={accionLiquidar}
              boton="Liquidar"
              conClave
              campos={[
                { nombre: "trabajadorId", etiqueta: "Trabajador", tipo: "select", opciones: trabajadores.map((w) => ({ valor: w.id, texto: w.nombre })) },
                { nombre: "desde", etiqueta: "Desde", tipo: "date", requerido: true, valorInicial: hoy() },
                { nombre: "hasta", etiqueta: "Hasta", tipo: "date", requerido: true, valorInicial: hoy() },
                { nombre: "descontarAnticipos", etiqueta: "Descontar anticipos pendientes", tipo: "checkbox" },
              ]}
            />
          </div>
        </details>
      )}
      <ul className="space-y-3">
        {lista.map((l) => (
          <li key={l.id} className="rounded-xl border border-borde shadow-sm bg-white p-3">
            <p className="font-bold">{l.trabajadorNombre} · {l.desde} a {l.hasta}</p>
            <p className="text-sm">
              Bruto {moneda(l.totalBruto)} · Anticipos {moneda(l.totalAnticipos)} · <strong>Neto {moneda(l.neto)}</strong> · Pagado {moneda(l.pagado)} ·{" "}
              <strong className={l.estado === "pagada" ? "text-bosque" : "text-alerta"}>{l.estado === "pagada" ? "Pagada" : `Saldo ${moneda(l.saldo)}`}</strong>
            </p>
            {paga && l.estado === "liquidada" && (
              <div className="mt-2">
                <FormularioGenerico
                  compacto
                  accion={accionPagarTrabajador}
                  boton="Registrar pago"
                  conClave
                  ocultos={{ liquidacionId: l.id }}
                  campos={[
                    { nombre: "monto", etiqueta: "Monto", tipo: "number", requerido: true, valorInicial: l.saldo },
                    { nombre: "metodo", etiqueta: "Método", tipo: "select", opciones: [{ valor: "efectivo", texto: "Efectivo" }, { valor: "transferencia", texto: "Transferencia" }] },
                    { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                  ]}
                />
              </div>
            )}
          </li>
        ))}
        {lista.length === 0 && <li>No hay liquidaciones.</li>}
      </ul>
    </section>
  );
}
