import { BotonEliminar } from "../../_componentes/BotonEliminar";
import { ErrorProhibido, listarAgroquimicos, listarCompras, listarFincasYLotes, listarProveedores, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { cantidad, moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionCrearProveedor, accionPagarCompra, accionRecibirCompra, accionRegistrarCompra } from "../finanzas/acciones";

export const metadata = { title: "Compra de insumos · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Compras() {
  const ctx = await exigirContexto();
  let compras;
  let proveedores;
  try {
    compras = await listarCompras(servicios().finanzas, ctx);
    proveedores = await listarProveedores(servicios().finanzas, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar compras.</p>;
    throw error;
  }
  const insumos = ctx.permisos.has("agroquimico:ver") ? await listarAgroquimicos(servicios().agricola, ctx).then((d) => d.catalogo).catch(() => []) : [];
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const p = (x: string) => ctx.permisos.has(x);
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Compra de insumos" detalle="Pedido → recepción (suma al inventario de insumos) → cuenta por pagar → pagos." />
      <div className="grid gap-4 xl:grid-cols-2">
        {p("proveedor:administrar") && (
          <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo proveedor</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionCrearProveedor} boton="Crear proveedor" campos={[
                { nombre: "nombre", etiqueta: "Nombre", requerido: true }, { nombre: "documento", etiqueta: "NIT o documento" }, { nombre: "telefono", etiqueta: "Teléfono" }, { nombre: "correo", etiqueta: "Correo" },
                { nombre: "autoriza", etiqueta: "Si es persona natural: autorizó el tratamiento de sus datos (Ley 1581)", tipo: "checkbox" },
              ]} />
            </div>
          </details>
        )}
        {p("compra:crear") && (
          <details open className="rounded-xl border-2 border-tinta/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nueva compra de insumos (hasta 3 productos)</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionRegistrarCompra} boton="Registrar pedido" conClave campos={[
                { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })) },
                { nombre: "proveedorId", etiqueta: "Proveedor", tipo: "select", opciones: proveedores.map((x) => ({ valor: x.id, texto: x.nombre })) },
                { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                ...[1, 2, 3].flatMap((n) => [
                  { nombre: `insumoId${n}`, etiqueta: `Insumo ${n}`, tipo: "select" as const, opciones: [{ valor: "", texto: n === 1 ? "Elija un insumo…" : "— ninguno —" }, ...insumos.map((i) => ({ valor: i.id, texto: `${i.nombre} (${i.unidad})` })), { valor: "otro", texto: "Otro (no va al inventario)" }] },
                  { nombre: `descripcion${n}`, etiqueta: `Si es otro, qué compró ${n}` },
                  { nombre: `cantidad${n}`, etiqueta: `Cantidad ${n}`, tipo: "number" as const, requerido: n === 1 },
                  { nombre: `unidad${n}`, etiqueta: `Unidad ${n}`, placeholder: "bulto, litro, unidad" },
                  { nombre: `costo${n}`, etiqueta: `Costo unitario ${n} (COP)`, tipo: "number" as const, requerido: n === 1 },
                ]),
              ]} />
            </div>
          </details>
        )}
      </div>

      {p("proveedor:administrar") && proveedores.length > 0 && (
        <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Mis proveedores ({proveedores.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {proveedores.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>{x.nombre}</strong>{x.telefono ? ` · ${x.telefono}` : ""}{Number(x.porPagar) > 0 ? ` · se le debe ${moneda(x.porPagar)}` : ""}</span>
                <BotonEliminar tipo="proveedor" id={x.id} nombre={x.nombre} />
              </li>
            ))}
          </ul>
        </details>
      )}

      <ul className="space-y-3">
        {compras.map((c) => (
          <li key={c.id} className="rounded-xl border-2 border-tinta/20 bg-white p-3">
            <p className="font-bold">Compra {c.numero} · {c.fecha} · {c.proveedorNombre} · {c.fincaNombre}</p>
            <ul className="text-sm">{c.lineas.map((l, i) => <li key={i}>{l.descripcion}: {cantidad(l.cantidad)} {l.unidad} × {moneda(l.costoUnitario)} = {moneda(l.subtotal)}</li>)}</ul>
            <p className="text-sm">
              Total <strong>{moneda(c.total)}</strong> · Pagado {moneda(c.pagado)} ·{" "}
              <strong className={c.estado === "pedida" ? "" : c.saldo === "0.00" ? "text-bosque" : "text-alerta"}>
                {c.estado === "pedida" ? "Pedida (sin recibir)" : c.saldo === "0.00" ? "Pagada" : `Por pagar ${moneda(c.saldo)}`}
              </strong>
            </p>
            {c.estado === "pedida" && p("compra:recibir") && (
              <div className="mt-2"><FormularioGenerico compacto accion={accionRecibirCompra} boton="Registrar recepción" ocultos={{ compraId: c.id }} campos={[{ nombre: "fecha", etiqueta: "Fecha de recepción", tipo: "date", requerido: true, valorInicial: hoy() }]} /></div>
            )}
            {c.estado === "recibida" && c.saldo !== "0.00" && p("pago_proveedor:registrar") && (
              <div className="mt-2">
                <FormularioGenerico compacto accion={accionPagarCompra} boton="Registrar pago" conClave ocultos={{ compraId: c.id }} campos={[
                  { nombre: "monto", etiqueta: "Monto", tipo: "number", requerido: true, valorInicial: c.saldo },
                  { nombre: "metodo", etiqueta: "Método", tipo: "select", opciones: [{ valor: "efectivo", texto: "Efectivo" }, { valor: "transferencia", texto: "Transferencia" }] },
                  { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                ]} />
              </div>
            )}
          </li>
        ))}
        {compras.length === 0 && <li>No hay compras registradas.</li>}
      </ul>
    </section>
  );
}
