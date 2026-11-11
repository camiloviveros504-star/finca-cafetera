import Link from "next/link";
import { ErrorNoEncontrado, ErrorProhibido, exportarDatosCliente, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../../_componentes/FormularioGenerico";
import { moneda } from "../../../_servidor/formatos";
import { exigirContexto } from "../../../_servidor/sesion";
import { accionAnonimizarCliente, accionRectificarCliente } from "../acciones";

export const metadata = { title: "Datos personales del cliente · Gestión de Finca Cafetera" };

export default async function DatosCliente({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigirContexto();
  const { id } = await params;
  let d;
  try {
    d = await exportarDatosCliente(servicios().derechosCliente, ctx, id);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para atender solicitudes de datos personales.</p>;
    if (error instanceof ErrorNoEncontrado) return <p role="alert" className="font-semibold text-alerta">Cliente no encontrado.</p>;
    throw error;
  }
  const suprimido = d.anonimizadoEn !== null;
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Datos personales del cliente" detalle="Ley 1581 de 2012: conocer, rectificar y suprimir." />
      <p><Link href="/clientes" className="font-semibold underline">← Volver a clientes</Link></p>
      <div className="rounded-xl border-2 border-tinta/20 bg-white p-4 text-sm">
        <p className="text-base font-extrabold">{d.titular.nombre}</p>
        <p>Documento: {d.titular.documento ?? "—"} · Teléfono: {d.titular.telefono ?? "—"} · Correo: {d.titular.correo ?? "—"} · Dirección: {d.titular.direccion ?? "—"}</p>
        <p>Finalidad: {d.finalidad}</p>
        <p>Autorización del titular: {d.autorizacionEn ?? "no registrada"}{suprimido ? ` · Datos suprimidos el ${d.anonimizadoEn}` : ""}</p>
        <p>Historial comercial: {d.resumenComercial.ventas} venta(s) por {moneda(d.resumenComercial.total)} · {d.resumenComercial.pedidos} pedido(s). Se conserva para que la contabilidad cuadre.</p>
      </div>
      {!suprimido && ctx.permisos.has("cliente:administrar") && (
        <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Rectificar datos</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionRectificarCliente} boton="Guardar cambios" ocultos={{ clienteId: id }} campos={[
              { nombre: "nombre", etiqueta: "Nombre", valorInicial: d.titular.nombre }, { nombre: "telefono", etiqueta: "Teléfono", valorInicial: d.titular.telefono ?? "" },
              { nombre: "correo", etiqueta: "Correo", valorInicial: d.titular.correo ?? "" }, { nombre: "direccion", etiqueta: "Dirección", valorInicial: d.titular.direccion ?? "" },
            ]} />
          </div>
        </details>
      )}
      {!suprimido && (
        <details className="rounded-xl border-2 border-alerta bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold text-alerta">Suprimir datos personales (anonimizar)</summary>
          <p className="mt-2 text-sm">Se borran nombre, documento, teléfono, correo y dirección. El registro y su historial de ventas se conservan, sin datos personales. No se puede deshacer.</p>
          <div className="mt-3">
            <FormularioGenerico accion={accionAnonimizarCliente} boton="Suprimir datos" ocultos={{ clienteId: id }} campos={[{ nombre: "motivo", etiqueta: "Solicitud del titular (mínimo 10 caracteres)", requerido: true }]} />
          </div>
        </details>
      )}
    </section>
  );
}
