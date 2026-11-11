import { ErrorProhibido, listarFincasYLotes, listarTrabajadores, listarTrabajos, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { cantidad, moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { FormularioTrabajoOffline } from "../../_componentes/FormulariosOffline";
import { accionValidarTrabajo } from "../trabajadores/acciones";

export const metadata = { title: "Producción de trabajadores · Gestión de Finca Cafetera" };
const ETIQUETA: Record<string, string> = { pendiente: "Pendiente de validar", validado: "Validado", rechazado: "Rechazado", liquidado: "Liquidado" };

export default async function Trabajo() {
  const ctx = await exigirContexto();
  let registros;
  try {
    registros = await listarTrabajos(servicios().talento, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar este módulo.</p>;
    throw error;
  }
  const datos = await listarFincasYLotes(servicios().fincasLotes, ctx).catch(() => ({ fincas: [], lotes: [] }));
  const terceros = ctx.permisos.has("trabajo:registrar");
  const trabajadores = terceros ? await listarTrabajadores(servicios().talento, ctx) : [];
  const puedeRegistrar = terceros || ctx.permisos.has("trabajo:registrar_propio");
  const valida = ctx.permisos.has("trabajo:validar");
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Producción de trabajadores" imagen="hero-2-recoleccion" alt="Manos de un recolector tomando cerezas maduras de café sobre un canasto" />
      <p className="text-sm">Quien trabaja declara la cantidad. El supervisor la valida y el sistema calcula el valor con la tarifa vigente en la fecha de la producción; nadie lo digita.</p>

      {puedeRegistrar && (
        <details open className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Registrar producción o jornada (funciona sin conexión)</summary>
          <div className="mt-3">
            <FormularioTrabajoOffline
              fincas={datos.fincas.map((f) => ({ valor: f.id, texto: f.nombre }))}
              lotes={datos.lotes.map((l) => ({ valor: l.id, texto: `${l.fincaNombre} · ${l.codigo}` }))}
              trabajadores={terceros ? trabajadores.map((w) => ({ valor: w.id, texto: w.nombre })) : undefined}
            />
          </div>
        </details>
      )}

      <ul className="space-y-3">
        {registros.map((r) => (
          <li key={r.id} className="rounded-xl border-2 border-cafe/20 bg-white p-3">
            <p className="font-bold">{r.trabajadorNombre} · {r.fecha} · {r.fincaNombre}{r.loteCodigo ? ` · ${r.loteCodigo}` : ""}</p>
            <p className="text-sm">
              Declarado: <strong>{cantidad(r.cantidadDeclarada)} {r.unidadDeclarada}</strong>
              {r.cantidadValidada !== null && <> · Validado: <strong>{cantidad(r.cantidadValidada)} {r.modalidad}</strong></>}
              {r.valor !== null && <> · Valor: <strong>{moneda(r.valor)}</strong> (tarifa {moneda(r.valorUnitario ?? 0)})</>}
            </p>
            <p className="text-sm font-semibold">{ETIQUETA[r.estado]}{r.motivoRechazo ? `: ${r.motivoRechazo}` : ""}</p>
            {valida && r.estado === "pendiente" && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <FormularioGenerico compacto accion={accionValidarTrabajo} boton="Validar" ocultos={{ registroId: r.id, decision: "validar" }} campos={[{ nombre: "cantidadValidada", etiqueta: "Cantidad validada", tipo: "number", valorInicial: r.cantidadDeclarada }]} />
                <FormularioGenerico compacto accion={accionValidarTrabajo} boton="Rechazar" ocultos={{ registroId: r.id, decision: "rechazar" }} campos={[{ nombre: "motivo", etiqueta: "Motivo del rechazo", requerido: true }]} />
              </div>
            )}
          </li>
        ))}
        {registros.length === 0 && <li>No hay registros.</li>}
      </ul>
    </section>
  );
}
