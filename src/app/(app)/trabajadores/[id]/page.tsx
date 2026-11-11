import Link from "next/link";
import { ErrorNoEncontrado, ErrorProhibido, exportarDatosTrabajador, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../../_componentes/FormularioGenerico";
import { exigirContexto } from "../../../_servidor/sesion";
import { accionAnonimizarTrabajador, accionRectificarTrabajador } from "../acciones";

export const metadata = { title: "Datos personales del trabajador · Gestión de Finca Cafetera" };

export default async function DatosTrabajador({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigirContexto();
  const { id } = await params;
  let d;
  try {
    d = await exportarDatosTrabajador(servicios().derechosTrabajador, ctx, id);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para atender solicitudes de datos personales.</p>;
    if (error instanceof ErrorNoEncontrado) return <p role="alert" className="font-semibold text-cereza">Trabajador no encontrado.</p>;
    throw error;
  }
  const suprimido = d.anonimizadoEn !== null;
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Datos personales del trabajador" detalle="Ley 1581 de 2012: conocer, rectificar y suprimir." />
      <p><Link href="/trabajadores" className="font-semibold underline">← Volver a trabajadores</Link></p>
      <div className="rounded-xl border-2 border-cafe/20 bg-white p-4 text-sm">
        <p className="text-base font-extrabold">{d.titular.nombres} {d.titular.apellidos}</p>
        <p>Documento: {d.titular.tipoDocumento} {d.titular.numeroDocumento} · Teléfono: {d.titular.telefono ?? "—"}</p>
        <p>Finalidad: {d.finalidad ?? "—"}</p>
        <p>Autorización del titular: {d.autorizacionEn ?? "no registrada"}{suprimido ? ` · Datos suprimidos el ${d.anonimizadoEn}` : ""}</p>
        <p>Historial: {d.resumenLaboral.registros} registro(s) de trabajo · {d.resumenLaboral.liquidaciones} liquidación(es) · {d.resumenLaboral.anticipos} anticipo(s). Se conserva para que los pagos cuadren.</p>
        {d.tieneUsuarioDeAcceso && <p className="font-semibold">Tiene un usuario de acceso: desactívelo desde Usuarios si se suprimen sus datos.</p>}
      </div>
      {!suprimido && ctx.permisos.has("trabajador:administrar") && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Rectificar datos</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionRectificarTrabajador} boton="Guardar cambios" ocultos={{ trabajadorId: id }} campos={[
              { nombre: "nombres", etiqueta: "Nombres", valorInicial: d.titular.nombres }, { nombre: "apellidos", etiqueta: "Apellidos", valorInicial: d.titular.apellidos },
              { nombre: "telefono", etiqueta: "Teléfono", valorInicial: d.titular.telefono ?? "" },
            ]} />
          </div>
        </details>
      )}
      {!suprimido && (
        <details className="rounded-xl border-2 border-cereza bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold text-cereza">Suprimir datos personales (anonimizar)</summary>
          <p className="mt-2 text-sm">Se borran nombres, apellidos, documento y teléfono. Las liquidaciones y pagos se conservan sin datos personales. No se puede deshacer.</p>
          <div className="mt-3">
            <FormularioGenerico accion={accionAnonimizarTrabajador} boton="Suprimir datos" ocultos={{ trabajadorId: id }} campos={[{ nombre: "motivo", etiqueta: "Solicitud del titular (mínimo 10 caracteres)", requerido: true }]} />
          </div>
        </details>
      )}
    </section>
  );
}
