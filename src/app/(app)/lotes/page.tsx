import { consultarCultivo, DENSIDAD_POR_DEFECTO, ErrorProhibido, listarAgroquimicos, listarCasosSanitarios, listarFincasYLotes, servicios, type CasoSanitario, type LoteConPlan } from "@/composicion";
import { AvisoPlaga, FormularioReportarPlaga, TarjetaCaso } from "../../_componentes/CasosSanitarios";
import { cantidad } from "../../_servidor/formatos";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { exigirContexto } from "../../_servidor/sesion";
import { EliminarLote, FormularioEventoLote, FormularioLote } from "./Formularios";

export const metadata = { title: "Lotes · Gestión de Finca Cafetera" };

const ORIGEN = {
  sin_sembrar: { texto: "Sin sembrar", clase: "bg-tinta/10 text-tinta" },
  nuevo: { texto: "Café nuevo", clase: "bg-bosque/15 text-bosque" },
  zoca: { texto: "Zoca (café cortado)", clase: "bg-ambar/25 text-tinta" },
} as const;
const ETAPA = { sin_sembrar: "Sin café", levante: "En levante", produccion: "En producción", renovacion: "Pide renovación" } as const;

function edad(meses: number | null) {
  if (meses === null) return "—";
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  return `${a > 0 ? `${a} ${a === 1 ? "año" : "años"}` : ""}${a > 0 && m > 0 ? " y " : ""}${m > 0 || a === 0 ? `${m} ${m === 1 ? "mes" : "meses"}` : ""}`;
}

const NOMBRE_EVENTO: Record<string, string> = { siembra: "Siembra", resiembra: "Resiembra", zoca: "Zoca", tumba: "Tumba", observacion: "Nota" };

interface Sanidad { casos: CasoSanitario[]; aplicaciones: { id: string; texto: string }[]; ve: boolean; registra: boolean }

function TarjetaLote({ l, puedeAdministrar, variasFincas, sanidad }: { l: LoteConPlan; puedeAdministrar: boolean; variasFincas: boolean; sanidad: Sanidad }) {
  const abiertos = sanidad.casos.filter((c) => c.estado !== "controlado");
  const controlados = sanidad.casos.length - abiertos.length;
  const o = ORIGEN[l.origen];
  const proxima = l.plan.find((p) => p.estado === "proxima");
  return (
    <li className="rounded-xl border border-borde shadow-sm bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold">{l.codigo} · {l.nombre}</p>
          <p className="text-sm text-suave">{variasFincas ? `${l.fincaNombre} · ` : ""}{l.areaHa ?? "—"} ha{l.variedad ? ` · ${l.variedad}` : ""}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <AvisoPlaga casos={sanidad.casos} />
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${o.clase}`}>{o.texto}</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-suave">Etapa</dt><dd className="font-semibold">{ETAPA[l.etapa]}</dd></div>
        <div><dt className="text-xs text-suave">{l.origen === "zoca" ? "Desde la zoca" : "Edad"}</dt><dd className="font-semibold">{edad(l.edadMeses)}</dd></div>
        <div><dt className="text-xs text-suave">Árboles</dt><dd className="font-semibold">{l.numeroArboles?.toLocaleString("es-CO") ?? "—"}</dd></div>
        <div><dt className="text-xs text-suave">Cosechado</dt><dd className="font-semibold">{cantidad(l.cosechadoKg)} kg</dd></div>
      </dl>
      {l.etapa === "sin_sembrar" && l.arbolesSugeridos && <p className="mt-2 text-xs text-suave">Para sembrarlo se sugieren unos {l.arbolesSugeridos.toLocaleString("es-CO")} árboles ({l.densidadReferencia.toLocaleString("es-CO")} por hectárea).</p>}
      {l.fechaSiembra && <p className="mt-2 text-xs text-suave">Sembrado el {l.fechaSiembra}{l.fechaUltimaZoca ? ` · zoca el ${l.fechaUltimaZoca}` : ""}</p>}

      {l.etapa === "renovacion" && (
        <p className="mt-3 rounded-lg border border-ambar/30 bg-ambar/5 p-3 text-sm">
          Este café ya cumplió su ciclo productivo. Opciones: hacer <strong>zoca</strong> (cortar y dejar rebrotar, menor costo) o <strong>tumbar y resembrar</strong> (permite cambiar variedad y densidad).
        </p>
      )}

      {sanidad.ve && l.etapa !== "sin_sembrar" && (
        <div className="mt-3 border-t border-borde pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Plagas y enfermedades</p>
            {abiertos.length === 0 && <span className="text-xs text-bosque">{controlados > 0 ? `Sin plagas activas · ${controlados} controlada(s)` : "Sin plagas reportadas"}</span>}
          </div>
          {abiertos.length > 0 && <div className="mt-2 space-y-2">{abiertos.map((c) => <TarjetaCaso key={c.id} caso={c} aplicaciones={sanidad.aplicaciones} puedeRegistrar={sanidad.registra} />)}</div>}
          {sanidad.registra && (
            <details className="mt-1">
              <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-alerta">Reportar plaga en este lote</summary>
              <div className="mt-2"><FormularioReportarPlaga loteId={l.id} /></div>
            </details>
          )}
        </div>
      )}

      {l.plan.length > 0 && (
        <details className="mt-3 border-t border-borde pt-1">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Plan de manejo por edad{proxima ? ` · próximo: ${proxima.titulo}` : ""}</summary>
          <ul className="space-y-2 text-sm">
            {l.plan.map((p) => (
              <li key={p.titulo + p.desdeMeses} className={`rounded-lg border p-3 ${p.estado === "proxima" ? "border-bosque/40 bg-bosque-claro" : "border-borde"}`}>
                <p className="font-bold">{p.titulo}{p.estado === "proxima" ? " · le toca" : p.estado === "pasada" ? " · ya pasó" : ""}</p>
                <p>{p.detalle}</p>
                {p.gramosPorPlanta && <p>{p.gramosPorPlanta} g por planta{p.kgTotales ? ` · ${p.kgTotales} kg para el lote` : ""}</p>}
                <p className="text-xs text-tinta/70">Fuente: {p.fuente}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {l.eventos.length > 0 && (
        <details className="mt-1">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Historial del lote</summary>
          <ul className="space-y-1 text-sm">
            {l.eventos.map((e) => (
              <li key={e.id}>{e.fecha} · <strong>{NOMBRE_EVENTO[e.tipo] ?? e.tipo}</strong>{e.arboles ? ` · ${e.arboles.toLocaleString("es-CO")} árboles` : ""}{e.detalle ? ` · ${e.detalle}` : ""}</li>
            ))}
          </ul>
        </details>
      )}

      {puedeAdministrar && (
        <div className="mt-2 border-t border-borde pt-1">
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-bosque">{l.etapa === "sin_sembrar" ? "Sembrar café" : "Registrar zoca, tumba o nota"}</summary>
            <div className="mt-2"><FormularioEventoLote loteId={l.id} estado={l.estado} densidad={l.densidadReferencia} areaHa={l.areaHa} /></div>
          </details>
          <div className="flex justify-end"><EliminarLote loteId={l.id} nombre={l.nombre} /></div>
        </div>
      )}
    </li>
  );
}

export default async function Lotes() {
  const ctx = await exigirContexto();
  let datos, lotes: LoteConPlan[];
  try {
    datos = await listarFincasYLotes(servicios().fincasLotes, ctx);
    lotes = await consultarCultivo(servicios().cultivo, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar lotes.</p>;
    throw error;
  }
  const puedeAdministrar = ctx.permisos.has("lote:administrar");
  const resumen = {
    sin: lotes.filter((l) => l.origen === "sin_sembrar").length,
    nuevo: lotes.filter((l) => l.origen === "nuevo").length,
    zoca: lotes.filter((l) => l.origen === "zoca").length,
  };
  const variasFincas = datos.fincas.length > 1;
  // Sanidad de cada lote: casos de plagas (abiertos y controlados) y las fumigaciones hechas en él, para ligarlas al tratamiento.
  const veSanidad = ctx.permisos.has("inspeccion:ver");
  const registraSanidad = ctx.permisos.has("inspeccion:registrar");
  const casos = veSanidad ? await listarCasosSanitarios(servicios().casosSanitarios, ctx).catch(() => []) : [];
  const aplicaciones = ctx.permisos.has("agroquimico:ver") ? await listarAgroquimicos(servicios().agricola, ctx).then((x) => x.aplicaciones).catch(() => []) : [];
  return (
    <div className="space-y-6">
      <EncabezadoModulo
        titulo="Lotes"
        detalle={lotes.length === 0 ? "Registre cada lote de su finca: área, si está sembrado y desde cuándo." : `${lotes.length} lote(s): ${resumen.nuevo} con café nuevo · ${resumen.zoca} en zoca · ${resumen.sin} sin sembrar.`}
      />
      <div className={`grid gap-6 ${puedeAdministrar && datos.fincas.length > 0 ? "lg:grid-cols-[1fr_340px]" : ""}`}>
        {lotes.length === 0 ? (
          <p className="h-fit rounded-xl border border-dashed border-borde bg-white p-6 text-center text-sm text-suave">Todavía no hay lotes.{puedeAdministrar ? " Cree el primero con el formulario." : ""}</p>
        ) : (
          <div className="h-fit space-y-6">
            {/* Con varias fincas, los lotes se agrupan bajo el nombre de su finca. */}
            {datos.fincas.filter((f) => lotes.some((l) => l.fincaId === f.id)).map((f) => (
              <section key={f.id} aria-label={f.nombre}>
                {variasFincas && (
                  <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold">
                    {f.nombre}
                    <span className="text-xs font-normal text-suave">{lotes.filter((l) => l.fincaId === f.id).length} lote(s){f.areaHa ? ` · ${f.areaHa} ha` : ""}</span>
                  </h2>
                )}
                <ul className="grid gap-4 xl:grid-cols-2">
                  {lotes.filter((l) => l.fincaId === f.id).map((l) => (
                    <TarjetaLote key={l.id} l={l} puedeAdministrar={puedeAdministrar} variasFincas={false} sanidad={{
                      casos: casos.filter((c) => c.loteId === l.id), ve: veSanidad, registra: registraSanidad,
                      aplicaciones: aplicaciones.filter((a) => a.loteId === l.id).slice(0, 10).map((a) => ({ id: a.id, texto: `${a.fecha} · ${a.agroquimico} · ${a.cantidadTotal}` })),
                    }} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {puedeAdministrar && datos.fincas.length > 0 && (
          <section className="h-fit rounded-xl border border-borde bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Nuevo lote</h2>
            <FormularioLote fincas={datos.fincas} densidad={lotes[0]?.densidadReferencia ?? DENSIDAD_POR_DEFECTO} />
          </section>
        )}
      </div>
    </div>
  );
}
