import { ErrorProhibido, listarCartera, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionPagoCliente } from "../finanzas/acciones";

export const metadata = { title: "Cartera · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Cartera() {
  const ctx = await exigirContexto();
  let filas;
  try {
    filas = await listarCartera(servicios().pagos, ctx, true);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar la cartera.</p>;
    throw error;
  }
  const registra = ctx.permisos.has("pago:registrar");
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Cartera de clientes" />
      <p className="text-sm">Ventas con saldo pendiente. Los comprobantes son internos; el sistema no emite facturas electrónicas DIAN.</p>
      <ul className="space-y-3">
        {filas.map((f) => (
          <li key={f.ventaId} className="rounded-xl border border-borde shadow-sm bg-white p-3">
            <p className="font-bold">Comprobante {f.comprobante} · {f.cliente} · {f.fincaNombre}</p>
            <p className="text-sm">Total {moneda(f.total)} · Pagado {moneda(f.pagado)} · <strong className="text-alerta">Saldo {moneda(f.saldo)}</strong> · {f.diasAntiguedad} día(s)</p>
            {registra && (
              <div className="mt-2">
                <FormularioGenerico
                  compacto
                  accion={accionPagoCliente}
                  boton="Registrar pago"
                  conClave
                  ocultos={{ ventaId: f.ventaId }}
                  campos={[
                    { nombre: "monto", etiqueta: "Monto", tipo: "number", requerido: true, valorInicial: f.saldo },
                    { nombre: "metodo", etiqueta: "Método", tipo: "select", opciones: [{ valor: "efectivo", texto: "Efectivo" }, { valor: "transferencia", texto: "Transferencia" }] },
                    { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                  ]}
                />
              </div>
            )}
          </li>
        ))}
        {filas.length === 0 && <li>No hay saldos pendientes.</li>}
      </ul>
    </section>
  );
}
