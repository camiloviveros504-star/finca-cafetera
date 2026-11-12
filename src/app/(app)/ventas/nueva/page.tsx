import { ErrorProhibido, obtenerOpcionesVenta, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../../_componentes/EncabezadoModulo";
import { FormularioGenerico, type CampoFormulario } from "../../../_componentes/FormularioGenerico";
import { cantidad } from "../../../_servidor/formatos";
import { exigirContexto } from "../../../_servidor/sesion";
import { accionRegistrarVenta } from "../acciones";
import { opcionesCatalogo } from "../../../_servidor/catalogos";

export const metadata = { title: "Registrar venta · Gestión de Finca Cafetera" };


export default async function NuevaVenta() {
  const ctx = await exigirContexto();
  try {
    const o = await obtenerOpcionesVenta(servicios().comercial, ctx);
    const METODOS = await opcionesCatalogo(ctx, "metodo_pago");
    const nombreFinca = new Map(o.fincas.map((f) => [f.id, f.nombre]));
    const nombreTipo = new Map(o.productos.map((p) => [p.id, p.nombre]));
    const tipos = o.productos.map((p) => ({ valor: p.id, texto: p.nombre }));
    const linea = (n: number, visibleSi?: string): CampoFormulario[] => [
      { nombre: `productoId${n}`, etiqueta: n === 1 ? "Tipo de café" : `Tipo de café ${n}`, tipo: "select", opciones: [{ valor: "", texto: n === 1 ? "Elija el tipo de café…" : "— ninguno —" }, ...tipos], visibleSi, seccion: n > 1 ? `Café ${n}` : undefined },
      { nombre: `kg${n}`, etiqueta: "Kilos", tipo: "number", visibleSi },
      { nombre: `precio${n}`, etiqueta: "Precio por kilo (COP)", tipo: "number", visibleSi },
    ];
    const campos: CampoFormulario[] = [
      ...(o.fincas.length > 1 ? [{ nombre: "fincaId", etiqueta: "Finca que vende", tipo: "select" as const, opciones: o.fincas.map((f) => ({ valor: f.id, texto: f.nombre })), ancho: "completo" as const }] : []),
      { nombre: "clienteId", etiqueta: "Comprador", tipo: "select", opciones: [{ valor: "", texto: o.clientes.length > 0 ? "Elija un comprador…" : "Aún no hay compradores" }, ...o.clientes.map((c) => ({ valor: c.id, texto: c.nombre }))] },
      { nombre: "compradorNuevo", etiqueta: "O escriba un comprador nuevo", placeholder: "Nombre de quien compra" },
      ...linea(1),
      { nombre: "masTipos", etiqueta: "Vendió más de un tipo de café", tipo: "checkbox" },
      ...linea(2, "masTipos"),
      ...linea(3, "masTipos"),
      { nombre: "pagado", etiqueta: "El comprador ya me pagó", tipo: "checkbox" },
      { nombre: "metodo", etiqueta: "¿Cómo le pagó?", tipo: "select", opciones: METODOS, visibleSi: "pagado", ayuda: "El valor de la venta entra a su billetera." },
      { nombre: "conFlete", etiqueta: "Pagué flete por esta venta", tipo: "checkbox" },
      { nombre: "flete", etiqueta: "Valor del flete (COP)", tipo: "number", visibleSi: "conFlete", ayuda: "Sale de su billetera como gasto de esta venta." },
      { nombre: "destino", etiqueta: "Destino o sector", placeholder: "Cooperativa, municipio…", visibleSi: "conFlete" },
      { nombre: "detalles", etiqueta: "Agregar detalles (variedad, taza, descuento, nota)", tipo: "checkbox" },
      { nombre: "variedad", etiqueta: "Variedad del café", visibleSi: "detalles" },
      { nombre: "taza", etiqueta: "Taza o calidad", visibleSi: "detalles" },
      ...(ctx.permisos.has("venta:descontar") ? [{ nombre: "descuentoPct", etiqueta: "Descuento (%)", tipo: "number" as const, visibleSi: "detalles" }] : []),
      { nombre: "nota", etiqueta: "Nota", tipo: "textarea", visibleSi: "detalles" },
    ];
    return (
      <div className="space-y-6">
        <EncabezadoModulo titulo="Registrar venta de café" detalle="Elija el tipo de café, los kilos y el precio. Lo vendido se descuenta de la bodega; marque los cuadros solo si aplican." />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="rounded-xl border border-borde bg-white p-5 shadow-sm sm:p-6">
            <FormularioGenerico accion={accionRegistrarVenta} boton="Registrar venta" conClave columnas={3} campos={campos} />
          </section>
          <aside className="h-fit rounded-xl border border-borde bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Café disponible</h2>
            {o.existencias.length === 0 ? (
              <p className="mt-2 text-sm text-suave">No hay café en bodega. Registre una recolección primero.</p>
            ) : (
              <ul className="mt-3 divide-y divide-borde text-sm">
                {o.existencias.map((x) => (
                  <li key={x.fincaId + x.productoId} className="flex justify-between gap-3 py-2">
                    <span className="text-tinta/85">{nombreTipo.get(x.productoId) ?? "Café"}{o.fincas.length > 1 ? ` · ${nombreFinca.get(x.fincaId)}` : ""}</span>
                    <span className="font-semibold tabular-nums">{cantidad(x.kg)} kg</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para registrar ventas.</p>;
    throw error;
  }
}
