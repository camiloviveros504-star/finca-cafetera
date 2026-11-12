import Link from "next/link";
import { ErrorProhibido, listarAgroquimicos, listarCompras, listarFincasYLotes, listarProveedores, servicios } from "@/composicion";
import { BotonEliminar } from "../../_componentes/BotonEliminar";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico, type CampoFormulario } from "../../_componentes/FormularioGenerico";
import { Tarjeta } from "../../_componentes/Pestanas";
import { cantidad, moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionPagarCompra, accionRecibirCompra } from "../finanzas/acciones";
import { accionCompraInsumos } from "./acciones";
import { opcionesCatalogo } from "../../_servidor/catalogos";

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
  const METODOS = await opcionesCatalogo(ctx, "metodo_pago");
  const insumos = ctx.permisos.has("agroquimico:ver") ? await listarAgroquimicos(servicios().agricola, ctx).then((d) => d.catalogo).catch(() => []) : [];
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const p = (x: string) => ctx.permisos.has(x);
  const opcionesInsumo = insumos.map((i) => ({ valor: i.id, texto: `${i.nombre} (por ${i.unidad})` }));
  const linea = (n: number, visibleSi?: string): CampoFormulario[] => [
    { nombre: `insumoId${n}`, etiqueta: n === 1 ? "Producto" : `Producto ${n}`, tipo: "select", visibleSi, seccion: n > 1 ? `Producto ${n}` : undefined, opciones: [{ valor: "", texto: n === 1 ? "Elija un insumo…" : "— ninguno —" }, ...opcionesInsumo] },
    { nombre: `cantidad${n}`, etiqueta: "Cantidad", tipo: "number", visibleSi },
    { nombre: `costo${n}`, etiqueta: "Precio por unidad (COP)", tipo: "number", visibleSi },
  ];
  const campos: CampoFormulario[] = [
    ...(fincas.length > 1 ? [{ nombre: "fincaId", etiqueta: "Finca", tipo: "select" as const, opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })) }] : []),
    { nombre: "proveedorId", etiqueta: "Proveedor", tipo: "select", opciones: [{ valor: "", texto: proveedores.length > 0 ? "Elija un proveedor…" : "Aún no hay proveedores" }, ...proveedores.map((x) => ({ valor: x.id, texto: x.nombre }))] },
    { nombre: "proveedorNuevo", etiqueta: "O escriba un proveedor nuevo", placeholder: "Almacén agropecuario…" },
    { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
    ...linea(1),
    { nombre: "esOtro", etiqueta: "El primer producto no está en la lista (no va al inventario)", tipo: "checkbox" },
    { nombre: "descripcion1", etiqueta: "¿Qué compró?", visibleSi: "esOtro", placeholder: "Machete, costales…" },
    { nombre: "unidad1", etiqueta: "Unidad", visibleSi: "esOtro", placeholder: "unidad, metro…" },
    { nombre: "masProductos", etiqueta: "Compró más de un producto", tipo: "checkbox" },
    ...linea(2, "masProductos"),
    ...linea(3, "masProductos"),
    { nombre: "recibido", etiqueta: "Ya lo recibí (suma al inventario de insumos)", tipo: "checkbox" },
    { nombre: "pagado", etiqueta: "Ya lo pagué (sale de la billetera)", tipo: "checkbox" },
    { nombre: "metodo", etiqueta: "¿Cómo pagó?", tipo: "select", opciones: METODOS, visibleSi: "pagado" },
  ];
  const pendientes = compras.filter((c) => c.estado === "pedida" || c.saldo !== "0.00");
  return (
    <div className="space-y-6">
      <EncabezadoModulo titulo="Compra de insumos" detalle="Registre lo que compra para la finca. Al recibirlo suma al inventario de insumos; al pagarlo sale de la billetera." />

      {p("compra:crear") && (
        <Tarjeta titulo="Nueva compra">
          {insumos.length === 0 && <p className="-mt-2 mb-4 text-sm text-suave">Aún no tiene insumos creados. Créelos en <Link href="/sanidad" className="font-medium text-bosque underline">Insumos</Link> para que lo comprado sume al inventario, o marque “no está en la lista”.</p>}
          <FormularioGenerico accion={accionCompraInsumos} boton="Registrar compra" conClave columnas={3} campos={campos} />
        </Tarjeta>
      )}

      <Tarjeta titulo={pendientes.length > 0 ? `Por recibir o por pagar (${pendientes.length})` : "Compras"} className="overflow-hidden !p-0 [&>h2]:mb-0 [&>h2]:border-b [&>h2]:border-borde [&>h2]:px-5 [&>h2]:py-3">
        {compras.length === 0 ? <p className="p-5 text-sm text-suave">No hay compras registradas.</p> : (
          <ul className="divide-y divide-borde">
            {compras.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.proveedorNombre} · {c.fecha}</p>
                    <p className="text-xs text-suave">{c.lineas.map((l) => `${l.descripcion}: ${cantidad(l.cantidad)} ${l.unidad}`).join(" · ")}{fincas.length > 1 ? ` · ${c.fincaNombre}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{moneda(c.total)}</p>
                    <p className={`text-xs font-medium ${c.estado === "pedida" ? "text-ambar" : c.saldo === "0.00" ? "text-bosque" : "text-alerta"}`}>
                      {c.estado === "pedida" ? "Sin recibir" : c.saldo === "0.00" ? "Pagada" : `Debe ${moneda(c.saldo)}`}
                    </p>
                  </div>
                </div>
                {c.estado === "pedida" && p("compra:recibir") && (
                  <div className="mt-2"><FormularioGenerico compacto accion={accionRecibirCompra} boton="Marcar como recibida" ocultos={{ compraId: c.id, fecha: hoy() }} campos={[]} /></div>
                )}
                {c.estado === "recibida" && c.saldo !== "0.00" && p("pago_proveedor:registrar") && (
                  <div className="mt-2">
                    <FormularioGenerico compacto accion={accionPagarCompra} boton="Registrar pago" conClave ocultos={{ compraId: c.id, fecha: hoy() }} campos={[
                      { nombre: "monto", etiqueta: "Valor", tipo: "number", requerido: true, valorInicial: c.saldo },
                      { nombre: "metodo", etiqueta: "Cómo", tipo: "select", opciones: METODOS },
                    ]} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {p("proveedor:administrar") && proveedores.length > 0 && (
        <details className="rounded-xl border border-borde bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold">Mis proveedores ({proveedores.length})</summary>
          <ul className="mt-3 divide-y divide-borde text-sm">
            {proveedores.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="font-medium">{x.nombre}</span>{x.telefono ? ` · ${x.telefono}` : ""}{Number(x.porPagar) > 0 ? <span className="text-alerta"> · se le debe {moneda(x.porPagar)}</span> : ""}</span>
                <BotonEliminar tipo="proveedor" id={x.id} nombre={x.nombre} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
