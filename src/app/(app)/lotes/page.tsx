import { consultarCultivo, DENSIDAD_POR_DEFECTO, ErrorProhibido, listarFincasYLotes, servicios, type LoteConPlan } from "@/composicion";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { EliminarLote, FormularioEventoLote, FormularioFinca, FormularioLote } from "./Formularios";

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

function TarjetaLote({ l, puedeAdministrar }: { l: LoteConPlan; puedeAdministrar: boolean }) {
  const o = ORIGEN[l.origen];
  const proxima = l.plan.find((p) => p.estado === "proxima");
  return (
    <li className="rounded-xl border-2 border-tinta/20 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-extrabold">{l.codigo} · {l.nombre}</p>
          <p className="text-sm">{l.fincaNombre} · {l.areaHa ?? "—"} ha{l.variedad ? ` · ${l.variedad}` : ""}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${o.clase}`}>{o.texto}</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-tinta/70">Etapa</dt><dd className="font-bold">{ETAPA[l.etapa]}</dd></div>
        <div><dt className="text-tinta/70">{l.origen === "zoca" ? "Edad desde la zoca" : "Edad del café"}</dt><dd className="font-bold">{edad(l.edadMeses)}</dd></div>
        <div><dt className="text-tinta/70">Árboles</dt><dd className="font-bold">{l.numeroArboles?.toLocaleString("es-CO") ?? (l.arbolesSugeridos ? `≈ ${l.arbolesSugeridos.toLocaleString("es-CO")} sugeridos` : "—")}</dd></div>
        <div><dt className="text-tinta/70">Cosechado</dt><dd className="font-bold">{cantidad(l.cosechadoKg)} kg</dd></div>
      </dl>
      {l.fechaSiembra && <p className="mt-2 text-sm">Sembrado el {l.fechaSiembra}{l.fechaUltimaZoca ? ` · zoca el ${l.fechaUltimaZoca}` : ""}</p>}

      {l.etapa === "renovacion" && (
        <p className="mt-2 rounded-lg bg-ambar/20 p-2 text-sm font-semibold">
          Este café ya cumplió su ciclo productivo. Opciones: hacer <strong>zoca</strong> (cortar y dejar rebrotar, menor costo) o <strong>tumbar y resembrar</strong> (permite cambiar variedad y densidad).
        </p>
      )}

      {l.plan.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Plan de manejo por edad{proxima ? ` · próximo: ${proxima.titulo}` : ""}</summary>
          <ul className="space-y-2 text-sm">
            {l.plan.map((p) => (
              <li key={p.titulo + p.desdeMeses} className={`rounded-lg border p-2 ${p.estado === "proxima" ? "border-bosque bg-bosque/5" : "border-tinta/15"}`}>
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
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Historial del lote</summary>
          <ul className="space-y-1 text-sm">
            {l.eventos.map((e) => (
              <li key={e.id}>{e.fecha} · <strong>{NOMBRE_EVENTO[e.tipo] ?? e.tipo}</strong>{e.arboles ? ` · ${e.arboles.toLocaleString("es-CO")} árboles` : ""}{e.detalle ? ` · ${e.detalle}` : ""}</li>
            ))}
          </ul>
        </details>
      )}

      {puedeAdministrar && (
        <div className="mt-2 space-y-2">
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-bosque">{l.etapa === "sin_sembrar" ? "Sembrar café" : "Registrar zoca, tumba o nota"}</summary>
            <div className="mt-2"><FormularioEventoLote loteId={l.id} estado={l.estado} densidad={l.densidadReferencia} areaHa={l.areaHa} /></div>
          </details>
          <EliminarLote loteId={l.id} nombre={l.nombre} />
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
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Lotes</h1>
        <p className="text-sm">{lotes.length} lote(s): {resumen.nuevo} con café nuevo · {resumen.zoca} en zoca · {resumen.sin} sin sembrar</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {ctx.permisos.has("finca:administrar") && (
          <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nueva finca</summary>
            <div className="mt-3"><FormularioFinca /></div>
          </details>
        )}
        {puedeAdministrar && datos.fincas.length > 0 && (
          <details className="rounded-xl border-2 border-tinta/20 bg-white p-4">
            <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo lote</summary>
            <div className="mt-3"><FormularioLote fincas={datos.fincas} densidad={lotes[0]?.densidadReferencia ?? DENSIDAD_POR_DEFECTO} /></div>
          </details>
        )}
      </div>

      {lotes.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-tinta/30 p-6 text-center">Todavía no hay lotes. Cree el primero con “Nuevo lote”.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lotes.map((l) => <TarjetaLote key={l.id} l={l} puedeAdministrar={puedeAdministrar} />)}
        </ul>
      )}
    </section>
  );
}
