import Link from "next/link";
import { ErrorProhibido, listarFincasYLotes, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { Tarjeta } from "../../_componentes/Pestanas";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionCrearFinca, accionEditarFinca } from "./acciones";

export const metadata = { title: "Mis fincas · Gestión de Finca Cafetera" };

const campos = (f?: { nombre: string; ubicacion: string | null; areaHa: string | null }) => [
  { nombre: "nombre", etiqueta: "Nombre de la finca", requerido: true, ancho: "completo" as const, placeholder: "La Esperanza", valorInicial: f?.nombre },
  { nombre: "ubicacion", etiqueta: "Ubicación (vereda, municipio)", ancho: "completo" as const, valorInicial: f?.ubicacion ?? undefined },
  { nombre: "areaHa", etiqueta: "Área total (ha)", tipo: "number" as const, ancho: "completo" as const, valorInicial: f?.areaHa ?? undefined },
];

/** El propietario registra aquí cada una de sus fincas; después crea los lotes de cada finca en “Lotes”. */
export default async function MisFincas() {
  const ctx = await exigirContexto();
  if (!ctx.permisos.has("finca:crear")) return <p role="alert" className="font-semibold text-alerta">Las fincas las registra su propietario.</p>;
  let datos;
  try {
    datos = await listarFincasYLotes(servicios().fincasLotes, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar fincas.</p>;
    throw error;
  }
  const fincas = datos.fincas.filter((f) => f.propietarioId === ctx.usuarioId);
  const lotesDe = (id: string) => datos.lotes.filter((l) => l.fincaId === id);
  const totalHa = fincas.reduce((s, f) => s + Number(f.areaHa ?? 0), 0);

  return (
    <div className="space-y-6">
      <EncabezadoModulo
        titulo="Mis fincas"
        detalle={fincas.length === 0
          ? "Registre cada finca que tenga, con su propio nombre. Después cree los lotes de cada una en “Lotes”."
          : `${fincas.length} finca(s) · ${datos.lotes.filter((l) => fincas.some((f) => f.id === l.fincaId)).length} lote(s) · ${cantidad(totalHa)} ha.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {fincas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-borde bg-white p-6 text-center text-sm text-suave">Todavía no ha registrado fincas. Cree la primera con el formulario.</p>
          ) : fincas.map((f) => {
            const lotes = lotesDe(f.id);
            const sembrados = lotes.filter((l) => l.estadoProductivo !== "sin_sembrar" && l.estadoProductivo !== "inactivo").length;
            return (
              <section key={f.id} className="rounded-xl border border-borde bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{f.nombre}</h2>
                    <p className="text-xs text-suave">{f.ubicacion ?? "Sin ubicación"} · {f.areaHa ? `${cantidad(f.areaHa)} ha` : "área sin registrar"}</p>
                  </div>
                  <dl className="flex gap-5 text-right text-sm">
                    <div><dt className="text-xs text-suave">Lotes</dt><dd className="font-semibold tabular-nums">{lotes.length}</dd></div>
                    <div><dt className="text-xs text-suave">Sembrados</dt><dd className="font-semibold tabular-nums">{sembrados}</dd></div>
                  </dl>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-6">
                  <Link href="/lotes" className="inline-flex min-h-10 items-center text-sm font-medium text-bosque hover:underline">{lotes.length === 0 ? "Crear sus lotes" : "Ver sus lotes"}</Link>
                  <details className="min-w-0 flex-1">
                    <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-suave">Editar datos de la finca</summary>
                    <div className="mt-2 max-w-md"><FormularioGenerico accion={accionEditarFinca} boton="Guardar" ocultos={{ fincaId: f.id }} campos={campos(f)} /></div>
                  </details>
                </div>
              </section>
            );
          })}
        </div>

        <Tarjeta titulo="Nueva finca" className="h-fit">
          <p className="-mt-2 mb-4 text-xs text-suave">Cada finca lleva su propio nombre, sus lotes, su bodega y sus ajustes. Si tiene varias, regístrelas una por una.</p>
          <FormularioGenerico accion={accionCrearFinca} boton="Crear finca" campos={campos()} />
        </Tarjeta>
      </div>
    </div>
  );
}
