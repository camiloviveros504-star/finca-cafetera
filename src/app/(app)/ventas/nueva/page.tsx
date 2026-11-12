import { consultarEstadoCafe, ErrorProhibido, obtenerOpcionesVenta, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../../_componentes/EncabezadoModulo";
import { FormularioGenerico, type CampoFormulario } from "../../../_componentes/FormularioGenerico";
import { cantidad } from "../../../_servidor/formatos";
import { exigirContexto } from "../../../_servidor/sesion";
import { accionRegistrarVenta } from "../acciones";
import { opcionesCatalogo } from "../../../_servidor/catalogos";

export const metadata = { title: "Registrar venta · Gestión de Finca Cafetera" };
const UNIDADES = [{ valor: "kg", texto: "Kilos" }, { valor: "arroba", texto: "Arrobas" }, { valor: "carga", texto: "Cargas" }];


export default async function NuevaVenta() {
  const ctx = await exigirContexto();
  try {
    const o = await obtenerOpcionesVenta(servicios().comercial, ctx);
    const METODOS = await opcionesCatalogo(ctx, "metodo_pago");
    const cafe = await consultarEstadoCafe(servicios().beneficio, ctx).catch(() => null);
    const tipos = o.productos.map((p) => ({ valor: p.id, texto: p.nombre }));
    const linea = (n: number, visibleSi?: string): CampoFormulario[] => [
      { nombre: `productoId${n}`, etiqueta: n === 1 ? "Tipo de café (en qué estado lo vende)" : `Tipo de café ${n}`, tipo: "select", opciones: [{ valor: "", texto: n === 1 ? "Elija el tipo de café…" : "— ninguno —" }, ...tipos], visibleSi, seccion: n > 1 ? `Café ${n}` : undefined, ancho: "completo" },
      { nombre: `kg${n}`, etiqueta: "Cantidad", tipo: "number", visibleSi },
      { nombre: `unidad${n}`, etiqueta: "Unidad", tipo: "select", visibleSi, opciones: UNIDADES },
      { nombre: `precio${n}`, etiqueta: "Precio por unidad (COP)", tipo: "number", visibleSi },
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
        <EncabezadoModulo titulo="Registrar venta de café" detalle="Elija en qué estado vende el café (rojo, húmedo, seco, almendra, tostado o molido), la cantidad en kilos, arrobas o cargas y el precio por esa unidad. Lo vendido se descuenta de la bodega en kilos." />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="rounded-xl border border-borde bg-white p-5 shadow-sm sm:p-6">
            <FormularioGenerico accion={accionRegistrarVenta} boton="Registrar venta" conClave columnas={3} campos={campos} />
          </section>
          <aside className="h-fit rounded-xl border border-borde bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Su café ahora</h2>
            {!cafe || cafe.estados.every((e) => Number(e.kg) === 0) ? (
              <p className="mt-2 text-sm text-suave">No hay café en bodega. Registre una recolección primero.</p>
            ) : (
              <ul className="mt-3 divide-y divide-borde text-sm">
                {cafe.estados.filter((e) => Number(e.kg) > 0).map((e) => (
                  <li key={e.codigo} className="flex justify-between gap-3 py-2">
                    <span className={e.enProceso ? "text-ambar" : "text-tinta/85"}>{e.nombre}{e.enProceso ? " · aún no se vende" : ""}</span>
                    <span className="whitespace-nowrap font-semibold tabular-nums">{cantidad(e.kg)} kg</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-suave">1 arroba = 12,5 kg y 1 carga = 125 kg, salvo que haya fijado otra equivalencia en Ajustes.</p>
          </aside>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para registrar ventas.</p>;
    throw error;
  }
}
