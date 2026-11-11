import { ErrorProhibido, listarAgroquimicos, listarAmbientales, listarCasosSanitarios, listarFincasYLotes, listarInspecciones, servicios } from "@/composicion";
import { FormularioReportarPlaga, TarjetaCaso } from "../../_componentes/CasosSanitarios";
import { BotonEliminar } from "../../_componentes/BotonEliminar";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { FormularioInspeccionOffline } from "../../_componentes/FormulariosOffline";
import { Pestanas, Tarjeta } from "../../_componentes/Pestanas";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionAmbiental, accionAplicacion, accionCrearAgroquimico, accionEntradaAgroquimico } from "./acciones";

export const metadata = { title: "Insumos · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const TIPOS_INSUMO = [
  { valor: "fertilizante", texto: "Fertilizante o abono" }, { valor: "fumigante", texto: "Fumigante (insecticida, fungicida)" },
  { valor: "herbicida", texto: "Herbicida" }, { valor: "herramienta", texto: "Herramienta o material" }, { valor: "otro", texto: "Otro" },
];
const NOMBRE_TIPO = Object.fromEntries(TIPOS_INSUMO.map((t) => [t.valor, t.texto.split(" (")[0]]));

export default async function Insumos({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const ctx = await exigirContexto();
  const p = (x: string) => ctx.permisos.has(x);
  if (!p("inspeccion:ver") && !p("agroquimico:ver")) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar insumos ni sanidad.</p>;
  const agro = p("agroquimico:ver") ? await listarAgroquimicos(servicios().agricola, ctx).catch((e) => { if (e instanceof ErrorProhibido) return null; throw e; }) : null;
  const pestanas = [
    ...(agro ? [{ clave: "inventario", texto: "Inventario", cuenta: agro.catalogo.length }, { clave: "aplicar", texto: "Asignar a lotes", cuenta: agro.aplicaciones.length }] : []),
    ...(p("inspeccion:ver") ? [{ clave: "sanidad", texto: "Plagas y sanidad" }] : []),
  ];
  const pedida = (await searchParams).ver;
  const ver = pestanas.some((x) => x.clave === pedida) ? pedida! : pestanas[0].clave;
  const datos = await listarFincasYLotes(servicios().fincasLotes, ctx).catch(() => ({ fincas: [], lotes: [] }));
  const variasFincas = datos.fincas.length > 1;
  const fincas = datos.fincas.map((f) => ({ valor: f.id, texto: f.nombre }));
  const lotes = datos.lotes.map((l) => ({ valor: l.id, texto: variasFincas ? `${l.fincaNombre} · ${l.codigo} ${l.nombre}` : `${l.codigo} ${l.nombre}` }));
  const unaFinca: Record<string, string> = datos.fincas.length === 1 ? { fincaId: datos.fincas[0].id } : {};

  return (
    <div className="space-y-6">
      <EncabezadoModulo titulo="Insumos" detalle="Abonos, fumigantes y herramientas: lo que tiene, lo que asigna a cada lote y la sanidad del cultivo. Las compras recibidas suman solas al inventario." />
      <Pestanas base="/sanidad" actual={ver} pestanas={pestanas} />

      {ver === "inventario" && agro && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Tarjeta titulo="Lo que tiene" className="overflow-hidden !p-0 [&>h2]:border-b [&>h2]:border-borde [&>h2]:px-5 [&>h2]:py-3 [&>h2]:mb-0">
            {agro.catalogo.length === 0 ? (
              <p className="p-5 text-sm text-suave">Aún no hay insumos. Créelos a la derecha o regístrelos al comprar.</p>
            ) : (
              <ul className="divide-y divide-borde">
                {agro.catalogo.map((a) => {
                  const existencias = agro.stock.filter((s) => s.agroquimicoId === a.id);
                  const disponible = existencias.reduce((t, s) => t + Number(s.cantidad), 0);
                  const vencido = existencias.some((s) => s.vencido && Number(s.cantidad) > 0);
                  const porVencer = existencias.some((s) => s.porVencer && Number(s.cantidad) > 0);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{a.nombre}</p>
                        <p className="text-xs text-suave">{NOMBRE_TIPO[a.tipo] ?? a.tipo} · por {a.unidad}{a.gramosPorUnidad ? ` de ${cantidad(Number(a.gramosPorUnidad) / 1000)} kg` : ""}{a.carenciaDias !== null ? ` · carencia ${a.carenciaDias} días` : ""}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {vencido ? <span className="rounded-full bg-alerta/10 px-2 py-0.5 text-xs font-medium text-alerta">Vencido</span> : porVencer ? <span className="rounded-full bg-ambar/10 px-2 py-0.5 text-xs font-medium text-ambar">Vence pronto</span> : null}
                        <span className={`text-sm font-semibold tabular-nums ${disponible === 0 ? "text-suave" : ""}`}>{cantidad(disponible)} {a.unidad}</span>
                        {p("agroquimico:administrar") && <BotonEliminar tipo="insumo" id={a.id} nombre={a.nombre} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>
          {p("agroquimico:administrar") && (
            <div className="space-y-4">
              <Tarjeta titulo="Nuevo insumo">
                <FormularioGenerico accion={accionCrearAgroquimico} boton="Crear insumo" ocultos={unaFinca} campos={[
                  { nombre: "nombre", etiqueta: "Nombre", requerido: true, placeholder: "Triple 15, Urea…", ancho: "completo" },
                  { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: TIPOS_INSUMO, ancho: "completo" },
                  { nombre: "unidad", etiqueta: "Se maneja por", requerido: true, placeholder: "bulto, litro, kilo", ancho: "completo" },
                  { nombre: "gramosPorUnidad", etiqueta: "Gramos por bulto", tipo: "number", placeholder: "50000 = bulto de 50 kg", ayuda: "Solo para abonos: permite calcular por gramos por árbol.", ancho: "completo" },
                  ...(variasFincas ? [{ nombre: "fincaId", etiqueta: "Finca", tipo: "select" as const, opciones: [{ valor: "", texto: "Todas mis fincas" }, ...fincas], ancho: "completo" as const }] : []),
                  { nombre: "esFumigante", etiqueta: "Tiene período de carencia", tipo: "checkbox" },
                  { nombre: "carenciaDias", etiqueta: "Días de carencia", tipo: "number", inputMode: "numeric", visibleSi: "esFumigante", ancho: "completo" },
                ]} />
              </Tarjeta>
              {agro.catalogo.length > 0 && (
                <Tarjeta titulo="Entrada sin compra">
                  <p className="-mt-2 mb-3 text-xs text-suave">Use esto solo si el insumo no entró por “Compra de insumos” (por ejemplo, un regalo o lo que ya tenía).</p>
                  <FormularioGenerico accion={accionEntradaAgroquimico} boton="Registrar entrada" ocultos={unaFinca} campos={[
                    ...(variasFincas ? [{ nombre: "fincaId", etiqueta: "Finca", tipo: "select" as const, opciones: fincas, ancho: "completo" as const }] : []),
                    { nombre: "agroquimicoId", etiqueta: "Insumo", tipo: "select", opciones: agro.catalogo.map((a) => ({ valor: a.id, texto: a.nombre })), ancho: "completo" },
                    { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number", requerido: true, ancho: "completo" },
                    { nombre: "conVencimiento", etiqueta: "Tiene fecha de vencimiento", tipo: "checkbox" },
                    { nombre: "vencimiento", etiqueta: "Vence el", tipo: "date", visibleSi: "conVencimiento", ancho: "completo" },
                    { nombre: "loteComercial", etiqueta: "Lote del proveedor", visibleSi: "conVencimiento", ancho: "completo" },
                  ]} />
                </Tarjeta>
              )}
            </div>
          )}
        </div>
      )}

      {ver === "aplicar" && agro && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Tarjeta titulo="Abonadas y fumigaciones" className="overflow-hidden !p-0 [&>h2]:border-b [&>h2]:border-borde [&>h2]:px-5 [&>h2]:py-3 [&>h2]:mb-0">
            {agro.aplicaciones.length === 0 ? (
              <p className="p-5 text-sm text-suave">Todavía no ha asignado insumos a ningún lote.</p>
            ) : (
              <ul className="divide-y divide-borde">
                {agro.aplicaciones.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.agroquimico} → lote {a.loteCodigo}</p>
                      <p className="text-xs text-suave">{a.fecha}{variasFincas ? ` · ${a.fincaNombre}` : ""}{a.gramosPorArbol ? ` · ${cantidad(a.gramosPorArbol)} g por árbol × ${a.arboles} árboles` : ""} · {a.responsable}{a.fechaReingreso ? ` · cosecha segura desde ${a.fechaReingreso}` : ""}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{cantidad(a.cantidadTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          {p("aplicacion:registrar") && (
            <Tarjeta titulo="Asignar a un lote">
              {agro.stock.filter((s) => !s.vencido && Number(s.cantidad) > 0).length === 0 ? (
                <p className="text-sm text-suave">No hay insumos disponibles. Regístrelos en la pestaña Inventario o en Compra de insumos.</p>
              ) : (
                <FormularioGenerico accion={accionAplicacion} boton="Asignar al lote" conClave campos={[
                  { nombre: "stockId", etiqueta: "Insumo", tipo: "select", ancho: "completo", opciones: agro.stock.filter((s) => !s.vencido && Number(s.cantidad) > 0).map((s) => ({ valor: s.id, texto: `${s.nombre} (${cantidad(s.cantidad)} ${s.unidad} disponibles)` })) },
                  { nombre: "loteId", etiqueta: "Lote", tipo: "select", opciones: lotes, ancho: "completo" },
                  { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy(), ancho: "completo" },
                  { nombre: "cantidadTotal", etiqueta: "Bultos o unidades", tipo: "number", ancho: "completo" },
                  { nombre: "porArbol", etiqueta: "Prefiero calcular por gramos por árbol", tipo: "checkbox" },
                  { nombre: "gramosPorArbol", etiqueta: "Gramos por árbol", tipo: "number", visibleSi: "porArbol", ayuda: "Se calcula con los árboles del lote y los gramos de cada bulto; deje vacíos los bultos.", ancho: "completo" },
                ]} />
              )}
            </Tarjeta>
          )}
        </div>
      )}

      {ver === "sanidad" && <Sanidad ctx={ctx} fincas={fincas} lotes={lotes} unaFinca={unaFinca} aplicaciones={(agro?.aplicaciones ?? []).map((a) => ({ id: a.id, loteId: a.loteId, texto: `${a.fecha} · ${a.agroquimico} · ${a.cantidadTotal}` }))} />}
    </div>
  );
}

async function Sanidad({ ctx, fincas, lotes, unaFinca, aplicaciones }: { ctx: Awaited<ReturnType<typeof exigirContexto>>; fincas: { valor: string; texto: string }[]; lotes: { valor: string; texto: string }[]; unaFinca: Record<string, string>; aplicaciones: { id: string; loteId: string; texto: string }[] }) {
  const casos = await listarCasosSanitarios(servicios().casosSanitarios, ctx).catch(() => []);
  const abiertos = casos.filter((c) => c.estado !== "controlado");
  const controlados = casos.filter((c) => c.estado === "controlado");
  const inspecciones = await listarInspecciones(servicios().agricola, ctx).catch(() => []);
  const ambientales = await listarAmbientales(servicios().agricola, ctx).catch(() => []);
  const registra = ctx.permisos.has("inspeccion:registrar");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Tarjeta titulo={abiertos.length > 0 ? `Plagas activas (${abiertos.length})` : "Plagas activas"}>
          {abiertos.length === 0 ? <p className="text-sm text-suave">Ningún lote tiene plagas activas.</p> : (
            <div className="space-y-3">{abiertos.map((c) => <TarjetaCaso key={c.id} caso={c} mostrarLote puedeRegistrar={registra} aplicaciones={aplicaciones.filter((a) => a.loteId === c.loteId)} />)}</div>
          )}
        </Tarjeta>
        {controlados.length > 0 && (
          <details open={abiertos.length === 0} className="rounded-xl border border-borde bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold">Plagas controladas ({controlados.length})</summary>
            <div className="mt-3 space-y-3">{controlados.map((c) => <TarjetaCaso key={c.id} caso={c} mostrarLote puedeRegistrar={registra} aplicaciones={aplicaciones.filter((a) => a.loteId === c.loteId)} />)}</div>
          </details>
        )}
        <Tarjeta titulo="Inspecciones" className="overflow-hidden !p-0 [&>h2]:border-b [&>h2]:border-borde [&>h2]:px-5 [&>h2]:py-3 [&>h2]:mb-0">
          {inspecciones.length === 0 ? <p className="p-5 text-sm text-suave">Aún no hay inspecciones.</p> : (
            <ul className="divide-y divide-borde">
              {inspecciones.map((i) => (
                <li key={i.id} className="px-5 py-3">
                  <p className="text-sm font-medium capitalize">{i.tipo} · severidad {i.severidad}{i.infestacionPct ? ` · ${i.infestacionPct} %` : ""}</p>
                  <p className="text-xs text-suave">{i.fecha}{i.loteCodigo ? ` · lote ${i.loteCodigo}` : ""} · {i.inspector}</p>
                  <p className="mt-1 text-sm">{i.hallazgos}{i.acciones ? ` — ${i.acciones}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        {ambientales.length > 0 && (
          <Tarjeta titulo="Registros ambientales">
            <ul className="divide-y divide-borde text-sm">{ambientales.map((a) => <li key={a.id} className="py-2">{a.fecha} · {a.tipo} · {a.descripcion}{a.cantidad ? ` · ${cantidad(a.cantidad)} ${a.unidad ?? ""}` : ""}</li>)}</ul>
          </Tarjeta>
        )}
      </div>
      {registra && (
        <div className="space-y-4">
          {lotes.length > 0 && (
            <Tarjeta titulo="Reportar una plaga">
              <FormularioReportarPlaga lotes={lotes} />
            </Tarjeta>
          )}
          <details className="rounded-xl border border-borde bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold">Inspección de rutina</summary>
            <p className="mb-3 mt-2 text-xs text-suave">Para dejar constancia de un recorrido por el lote, aunque no encuentre plagas. Funciona sin conexión: se envía sola cuando vuelva la señal.</p>
            <FormularioInspeccionOffline fincas={fincas} lotes={lotes} />
          </details>
          <details className="rounded-xl border border-borde bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold">Registro ambiental (envases, residuos, agua)</summary>
            <div className="mt-3">
              <FormularioGenerico accion={accionAmbiental} boton="Registrar" conClave ocultos={unaFinca} campos={[
                ...(fincas.length > 1 ? [{ nombre: "fincaId", etiqueta: "Finca", tipo: "select" as const, opciones: fincas, ancho: "completo" as const }] : []),
                { nombre: "tipo", etiqueta: "Tipo", tipo: "select", ancho: "completo", opciones: [["envases", "Envases de agroquímicos"], ["residuos", "Residuos"], ["agua", "Agua"], ["erosion", "Erosión"], ["otro", "Otro"]].map(([valor, texto]) => ({ valor, texto })) },
                { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy(), ancho: "completo" },
                { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea", requerido: true },
                { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number" },
                { nombre: "unidad", etiqueta: "Unidad" },
              ]} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
