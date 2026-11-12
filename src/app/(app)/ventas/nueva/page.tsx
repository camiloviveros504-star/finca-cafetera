import { consultarEstadoCafe, ErrorProhibido, obtenerAjustes, obtenerOpcionesVenta, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../../_componentes/EncabezadoModulo";
import { exigirContexto } from "../../../_servidor/sesion";
import { opcionesCatalogo } from "../../../_servidor/catalogos";
import { accionRegistrarVenta } from "../acciones";
import { FormularioVenta, type DatosVenta } from "./FormularioVenta";

export const metadata = { title: "Registrar venta · Gestión de Finca Cafetera" };

/** Kilos de una arroba y de una carga en cada finca: la equivalencia de la finca o, si no tiene, la general. */
function factoresPorFinca(fincas: { id: string }[], equivalencias: { fincaId: string | null; origen: string; destino: string; factor: string; vigente: boolean }[]) {
  const de = (fincaId: string, origen: string, porDefecto: number) => {
    const vigentes = equivalencias.filter((e) => e.vigente && e.origen === origen && e.destino === "kg");
    const f = vigentes.find((e) => e.fincaId === fincaId) ?? vigentes.find((e) => e.fincaId === null);
    return f ? Number(f.factor) : porDefecto;
  };
  return Object.fromEntries(fincas.map((f) => [f.id, { arroba: de(f.id, "arroba", 12.5), carga: de(f.id, "carga", 125) }]));
}

export default async function NuevaVenta() {
  const ctx = await exigirContexto();
  try {
    const o = await obtenerOpcionesVenta(servicios().comercial, ctx);
    const metodos = await opcionesCatalogo(ctx, "metodo_pago");
    const cafe = await consultarEstadoCafe(servicios().beneficio, ctx).catch(() => null);
    const equivalencias = await obtenerAjustes(servicios().ajustes, ctx).then((a) => a.equivalencias).catch(() => []);
    const enProceso: DatosVenta["enProceso"] = [];
    for (const e of cafe?.estados.filter((x) => x.enProceso) ?? []) {
      for (const f of o.fincas) {
        const kg = (cafe?.porLote ?? []).filter((r) => r.fincaId === f.id && r.estado === e.codigo).reduce((a, r) => a + Number(r.kg), 0);
        if (kg > 0) enProceso.push({ fincaId: f.id, nombre: e.nombre, kg });
      }
    }
    const datos: DatosVenta = {
      fincas: o.fincas,
      clientes: o.clientes,
      productos: o.productos.map((p) => ({ id: p.id, nombre: p.nombre })),
      existencias: o.existencias,
      enProceso,
      factores: factoresPorFinca(o.fincas, equivalencias),
      metodos,
      puedeDescontar: ctx.permisos.has("venta:descontar"),
    };
    return (
      <div className="space-y-6">
        <EncabezadoModulo titulo="Registrar venta de café" detalle="Elija en qué estado vende el café y la cantidad en kilos, arrobas o cargas. Solo aparece el café que tiene la finca en este momento; el que está en lavado o en secado no se vende hasta terminar." />
        <FormularioVenta accion={accionRegistrarVenta} datos={datos} />
      </div>
    );
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para registrar ventas.</p>;
    throw error;
  }
}
