import Link from "next/link";
import { consultarEstadoCafe, ErrorProhibido, listarRegistrosProceso, PASOS_CAFE, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionAvanzarCafe } from "./acciones";
import { FormularioPaso } from "./FormularioPaso";

export const metadata = { title: "Café en bodega · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

/**
 * Café en bodega: cuánto café hay en cada estado (rojo, en lavado, húmedo, en secado, seco, almendra, tostado, molido),
 * en tiempo real, y desde aquí se avanza al siguiente paso. En cada estado vendible se puede vender.
 */
export default async function CafeEnBodega({ searchParams }: { searchParams: Promise<{ paso?: string }> }) {
  const ctx = await exigirContexto();
  let cafe;
  try {
    cafe = await consultarEstadoCafe(servicios().beneficio, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar el café en bodega.</p>;
    throw error;
  }
  const { paso: pasoInicial } = await searchParams;
  const avanza = ctx.permisos.has("proceso:registrar");
  const vende = ctx.permisos.has("venta:crear");
  const registros = ctx.permisos.has("proceso:ver")
    ? (await listarRegistrosProceso(servicios().beneficio, ctx).catch(() => [])).filter((r) => r.procesoNombre === "Camino del café").slice(0, 15)
    : [];
  const nombres = Object.fromEntries(cafe.estados.map((e) => [e.codigo, e.nombre]));
  const principales = cafe.estados.filter((e) => e.principal);
  const subproductos = cafe.estados.filter((e) => !e.principal && Number(e.kg) > 0);
  const totalKg = cafe.estados.reduce((a, e) => a + Number(e.kg), 0);
  const variasFincas = new Set(cafe.porLote.map((f) => f.fincaId)).size > 1;
  const lotes = [...new Map(cafe.porLote.map((f) => [f.loteId, f])).values()];
  const siguiente = (codigo: string) => PASOS_CAFE.find((p) => p.entrada === codigo);

  return (
    <div className="space-y-6">
      <EncabezadoModulo
        titulo="Café en bodega"
        detalle="Cuánto café tiene en cada estado, al momento. El café entra rojo con la recolección; desde aquí lo despulpa, lava, seca, trilla, tuesta o muele, y lo puede vender en cualquier estado que no esté en proceso."
        accion={vende ? <Link href="/ventas/nueva" className="inline-flex min-h-10 items-center rounded-lg bg-bosque px-4 text-sm font-semibold text-white hover:bg-bosque/90">Vender café</Link> : undefined}
      />

      <section aria-label="Estados del café">
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {principales.map((e, i) => {
            const kg = Number(e.kg);
            const paso = siguiente(e.codigo);
            return (
              <li key={e.codigo} className={`flex min-w-0 flex-col rounded-xl border p-3 shadow-sm ${e.enProceso ? "border-ambar/40 bg-ambar/5" : "border-borde bg-white"} ${kg > 0 ? "" : "opacity-70"}`}>
                <p className="text-xs font-medium text-suave">{i + 1}. {e.nombre}</p>
                <p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums">{cantidad(e.kg)} kg</p>
                <p className={`mt-1 text-xs font-medium ${e.enProceso ? "text-ambar" : "text-bosque"}`}>{e.enProceso ? "En proceso" : "Se puede vender"}</p>
                {avanza && paso && kg > 0 && (
                  <Link href={`/inventario?paso=${paso.codigo}#avanzar`} className="mt-2 text-xs font-semibold text-bosque underline-offset-2 hover:underline">{paso.nombre} →</Link>
                )}
              </li>
            );
          })}
        </ol>
        {subproductos.length > 0 && (
          <p className="mt-3 text-sm text-suave">Subproductos: {subproductos.map((s) => `${s.nombre} ${cantidad(s.kg)} kg`).join(" · ")}</p>
        )}
      </section>

      <div className={`grid gap-6 ${avanza ? "lg:grid-cols-[1fr_420px]" : ""}`}>
        <section className="min-w-0 rounded-xl border border-borde bg-white shadow-sm">
          <h2 className="border-b border-borde px-5 py-3 text-sm font-semibold">Por lote de origen</h2>
          {totalKg === 0 ? (
            <p className="p-5 text-sm text-suave">No hay café en bodega. Registre una <Link href="/cosechas" className="font-medium text-bosque underline">recolección</Link> para empezar.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {lotes.map((l) => (
                <li key={l.loteId} className="px-5 py-3">
                  <p className="text-sm font-semibold">{variasFincas ? `${l.fincaNombre} · ` : ""}{l.loteCodigo} · {l.loteNombre}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cafe.estados.map((e) => {
                      const kg = cafe.porLote.filter((f) => f.loteId === l.loteId && f.estado === e.codigo).reduce((a, f) => a + Number(f.kg), 0);
                      return kg > 0 ? (
                        <span key={e.codigo} className={`rounded-full px-3 py-1 text-xs font-medium ${e.enProceso ? "bg-ambar/10 text-ambar" : "bg-bosque-claro text-bosque"}`}>
                          {e.nombre}: <span className="tabular-nums">{cantidad(kg)} kg</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {avanza && (
          <section id="avanzar" className="h-fit scroll-mt-20 rounded-xl border border-borde bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Avanzar el café</h2>
            <FormularioPaso
              key={pasoInicial ?? "inicio"}
              accion={accionAvanzarCafe}
              pasos={PASOS_CAFE.map((p) => ({ ...p }))}
              nombres={nombres}
              hoy={hoy()}
              pasoInicial={PASOS_CAFE.some((p) => p.codigo === pasoInicial) ? pasoInicial : undefined}
              disponibles={cafe.porLote.map((f) => ({ fincaId: f.fincaId, loteId: f.loteId, lote: `${variasFincas ? `${f.fincaNombre} · ` : ""}${f.loteCodigo} ${f.loteNombre}`, estado: f.estado, kg: f.kg }))}
            />
          </section>
        )}
      </div>

      {registros.length > 0 && (
        <section className="rounded-xl border border-borde bg-white shadow-sm">
          <h2 className="border-b border-borde px-5 py-3 text-sm font-semibold">Últimos pasos registrados</h2>
          <ul className="divide-y divide-borde text-sm">
            {registros.map((r) => {
              const rendimiento = Math.round((Number(r.salidaTotal) / Number(r.entradaTotal)) * 1000) / 10;
              return (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                  <span><span className="font-medium">{r.etapaNombre}</span> · {r.fecha}{variasFincas ? ` · ${r.fincaNombre}` : ""} · {r.responsable}</span>
                  <span className="tabular-nums text-suave">{cantidad(r.entradaTotal)} kg → {cantidad(r.salidaTotal)} kg{rendimiento < 100 ? ` (${rendimiento} %)` : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
