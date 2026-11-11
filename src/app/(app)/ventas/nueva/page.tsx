import { ErrorProhibido, obtenerOpcionesVenta, servicios } from "@/composicion";
import { FormularioGenerico } from "../../../_componentes/FormularioGenerico";
import { cantidad } from "../../../_servidor/formatos";
import { exigirContexto } from "../../../_servidor/sesion";
import { accionRegistrarVenta } from "../acciones";

export const metadata = { title: "Registrar venta · Gestión de Finca Cafetera" };

export default async function NuevaVenta() {
  const ctx = await exigirContexto();
  try {
    const o = await obtenerOpcionesVenta(servicios().comercial, ctx);
    const nombreFinca = new Map(o.fincas.map((f) => [f.id, f.nombre]));
    const nombreTipo = new Map(o.productos.map((p) => [p.id, p.nombre]));
    const puedeDescontar = ctx.permisos.has("venta:descontar");
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">Registrar venta de café</h1>
          <p className="text-sm">Elija qué tipo de café vendió, cuántos kilos y a cómo lo vendió. Lo vendido se descuenta de las existencias de ese tipo de café.</p>
        </div>

        <div className="rounded-xl border-2 border-tinta/20 bg-white p-4">
          <h2 className="font-extrabold">Café disponible para vender</h2>
          {o.existencias.length === 0 ? (
            <p className="text-sm">No hay café en bodega. Registre una recolección primero.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {o.existencias.map((x) => (
                <li key={x.fincaId + x.productoId}>{nombreTipo.get(x.productoId) ?? "Café"}{o.fincas.length > 1 ? ` · ${nombreFinca.get(x.fincaId)}` : ""}: <strong>{cantidad(x.kg)} kg</strong></li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border-2 border-tinta/20 bg-white p-4">
          <FormularioGenerico
            accion={accionRegistrarVenta}
            boton="Registrar venta"
            conClave
            campos={[
              ...(o.fincas.length > 1 ? [{ nombre: "fincaId", etiqueta: "Finca que vende", tipo: "select" as const, opciones: o.fincas.map((f) => ({ valor: f.id, texto: f.nombre })) }] : []),
              { nombre: "clienteId", etiqueta: "Comprador", tipo: "select" as const, opciones: [{ valor: "", texto: o.clientes.length > 0 ? "Elija un comprador…" : "Aún no hay compradores: escriba uno nuevo" }, ...o.clientes.map((c) => ({ valor: c.id, texto: c.nombre }))] },
              { nombre: "compradorNuevo", etiqueta: "O escriba un comprador nuevo", placeholder: "Nombre de quien compra" },
              ...[1, 2, 3].flatMap((n) => [
                { nombre: `productoId${n}`, etiqueta: n === 1 ? "Tipo de café" : `Tipo de café ${n} (opcional)`, tipo: "select" as const, opciones: [{ valor: "", texto: n === 1 ? "Elija el tipo de café…" : "— ninguno —" }, ...o.productos.map((p) => ({ valor: p.id, texto: p.nombre }))] },
                { nombre: `kg${n}`, etiqueta: `Kilos ${n}`, tipo: "number" as const },
                { nombre: `precio${n}`, etiqueta: `Precio por kilo ${n} (COP)`, tipo: "number" as const },
              ]),
              ...(puedeDescontar ? [{ nombre: "descuentoPct", etiqueta: "Descuento (%) · opcional", tipo: "number" as const }] : []),
              { nombre: "variedad", etiqueta: "Variedad del café · opcional" },
              { nombre: "taza", etiqueta: "Taza o calidad · opcional" },
              { nombre: "destino", etiqueta: "Destino o sector de entrega · opcional" },
              { nombre: "flete", etiqueta: "Flete pagado por esta venta (COP) · opcional", tipo: "number" as const },
              { nombre: "nota", etiqueta: "Nota · opcional", tipo: "textarea" as const },
            ]}
          />
        </div>
      </section>
    );
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para registrar ventas.</p>;
    throw error;
  }
}
