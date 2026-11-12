"use client";

import { useActionState, useId, useState } from "react";
import { estiloCampo } from "../../../_componentes/FormularioGenerico";

interface Estado {
  ok?: boolean;
  error?: string;
  mensaje?: string;
  campos?: Record<string, string>;
}
type Accion = (previo: Estado, datos: FormData) => Promise<Estado>;
type Unidad = "kg" | "arroba" | "carga";
type Linea = { clave: string; productoId: string; cantidad: string; unidad: Unidad; precio: string };

export interface DatosVenta {
  fincas: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  /** Tipos de café que se pueden vender (los que están en proceso no). */
  productos: { id: string; nombre: string }[];
  /** Kilos de cada tipo de café por finca, en este momento. */
  existencias: { fincaId: string; productoId: string; kg: string }[];
  /** Café en proceso por finca (en lavado, en secado): se muestra pero no se vende. */
  enProceso: { fincaId: string; nombre: string; kg: number }[];
  /** Kilos de una arroba y de una carga en cada finca (equivalencia vigente). */
  factores: Record<string, { arroba: number; carga: number }>;
  metodos: { valor: string; texto: string }[];
  puedeDescontar: boolean;
}

const NOMBRE_UNIDAD: Record<Unidad, [string, string]> = { kg: ["kilo", "kilos"], arroba: ["arroba", "arrobas"], carga: ["carga", "cargas"] };
const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const fmt = (n: number, dec = 3) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: dec }).format(n);
const pesos = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const nuevaLinea = (): Linea => ({ clave: crypto.randomUUID(), productoId: "", cantidad: "", unidad: "kg", precio: "" });

/**
 * Venta de café. Muestra en tiempo real cuánto hay de cada tipo de café en la finca que vende, en la unidad elegida, y solo
 * ofrece lo que se puede vender y tiene kilos. El servidor vuelve a validar las existencias dentro de la transacción (D1).
 */
export function FormularioVenta({ accion, datos }: { accion: Accion; datos: DatosVenta }) {
  const id = useId();
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const [fincaId, setFincaId] = useState(datos.fincas[0]?.id ?? "");
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()]);
  const [pagado, setPagado] = useState(false);
  const [conFlete, setConFlete] = useState(false);
  const [estado, enviar, pendiente] = useActionState<Estado, FormData>(async (previo, d) => {
    const r = await accion(previo, d);
    if (r.ok) setClave(crypto.randomUUID());
    return r;
  }, {});

  const factor = (u: Unidad) => (u === "kg" ? 1 : datos.factores[fincaId]?.[u] ?? (u === "arroba" ? 12.5 : 125));
  const disponibleKg = (productoId: string) => datos.existencias.filter((x) => x.fincaId === fincaId && x.productoId === productoId).reduce((a, x) => a + Number(x.kg), 0);
  /** Kilos ya puestos en otras líneas del mismo tipo de café. */
  const usadoEnOtras = (l: Linea) => lineas.filter((o) => o.clave !== l.clave && o.productoId === l.productoId).reduce((a, o) => a + num(o.cantidad) * factor(o.unidad), 0);
  const conCafe = datos.productos.filter((p) => disponibleKg(p.id) > 0);
  const enProceso = datos.enProceso.filter((x) => x.fincaId === fincaId && x.kg > 0);
  const cambiar = (c: string, campo: keyof Linea, valor: string) => setLineas((ls) => ls.map((l) => (l.clave === c ? { ...l, [campo]: valor } : l)));
  const total = lineas.reduce((a, l) => a + num(l.cantidad) * num(l.precio), 0);
  const excede = lineas.some((l) => l.productoId && num(l.cantidad) * factor(l.unidad) > disponibleKg(l.productoId) - usadoEnOtras(l) + 1e-9);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <form action={enviar} className="space-y-5 rounded-xl border border-borde bg-white p-5 shadow-sm sm:p-6">
        <input type="hidden" name="claveIdempotencia" value={clave} />
        {datos.fincas.length > 1 ? (
          <div>
            <label htmlFor={`${id}-finca`} className="mb-1 block text-sm font-medium">Finca que vende</label>
            <select id={`${id}-finca`} name="fincaId" value={fincaId} onChange={(e) => { setFincaId(e.target.value); setLineas([nuevaLinea()]); }} className={estiloCampo}>
              {datos.fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
        ) : (
          <input type="hidden" name="fincaId" value={fincaId} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-cliente`} className="mb-1 block text-sm font-medium">Comprador</label>
            <select id={`${id}-cliente`} name="clienteId" defaultValue="" className={estiloCampo}>
              <option value="">{datos.clientes.length > 0 ? "Elija un comprador…" : "Aún no hay compradores"}</option>
              {datos.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-nuevo`} className="mb-1 block text-sm font-medium">O escriba un comprador nuevo</label>
            <input id={`${id}-nuevo`} name="compradorNuevo" placeholder="Nombre de quien compra" className={estiloCampo} />
          </div>
        </div>

        {conCafe.length === 0 ? (
          <p role="alert" className="rounded-lg border border-ambar/40 bg-ambar/5 p-3 text-sm">Esta finca no tiene café para vender en este momento{enProceso.length > 0 ? " (solo hay café en proceso)" : ""}.</p>
        ) : (
          <div className="space-y-3">
            {lineas.map((l, i) => {
              const n = i + 1;
              const libreKg = l.productoId ? Math.max(disponibleKg(l.productoId) - usadoEnOtras(l), 0) : 0;
              const libre = libreKg / factor(l.unidad);
              const pedidoKg = num(l.cantidad) * factor(l.unidad);
              const pasa = l.productoId !== "" && pedidoKg > libreKg + 1e-9;
              return (
                <fieldset key={l.clave} className="space-y-3 rounded-lg border border-borde bg-fondo/40 p-3">
                  <legend className="px-1 text-sm font-medium">{lineas.length > 1 ? `Café ${n}` : "Café que vende"}</legend>
                  <div>
                    <label htmlFor={`${id}-p${n}`} className="mb-1 block text-xs font-medium">Tipo de café (en qué estado lo vende)</label>
                    <select id={`${id}-p${n}`} name={`productoId${n}`} value={l.productoId} onChange={(e) => cambiar(l.clave, "productoId", e.target.value)} className={estiloCampo}>
                      <option value="">Elija el tipo de café…</option>
                      {conCafe.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {fmt(disponibleKg(p.id))} kg disponibles</option>)}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor={`${id}-c${n}`} className="mb-1 block text-xs font-medium">Cantidad</label>
                      <div className="flex gap-2">
                        <input id={`${id}-c${n}`} name={`kg${n}`} inputMode="decimal" value={l.cantidad} onChange={(e) => cambiar(l.clave, "cantidad", e.target.value)} placeholder="0" className={estiloCampo} aria-invalid={pasa} />
                        {l.productoId && libre > 0 && (
                          <button type="button" onClick={() => cambiar(l.clave, "cantidad", String(Math.floor(libre * 1000) / 1000))} className="min-h-11 shrink-0 rounded-lg border border-borde bg-white px-3 text-xs font-medium hover:bg-fondo">Todo</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`${id}-u${n}`} className="mb-1 block text-xs font-medium">Unidad</label>
                      <select id={`${id}-u${n}`} name={`unidad${n}`} value={l.unidad} onChange={(e) => cambiar(l.clave, "unidad", e.target.value)} className={estiloCampo}>
                        <option value="kg">Kilos</option>
                        <option value="arroba">Arrobas ({fmt(factor("arroba"))} kg)</option>
                        <option value="carga">Cargas ({fmt(factor("carga"))} kg)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${id}-pr${n}`} className="mb-1 block text-xs font-medium">Precio por {NOMBRE_UNIDAD[l.unidad][0]} (COP)</label>
                      <input id={`${id}-pr${n}`} name={`precio${n}`} inputMode="decimal" value={l.precio} onChange={(e) => cambiar(l.clave, "precio", e.target.value)} placeholder="0" className={estiloCampo} />
                    </div>
                  </div>
                  {l.productoId && (
                    <p className={`text-xs ${pasa ? "font-semibold text-alerta" : "text-suave"}`}>
                      {pasa
                        ? `No alcanza: hay ${fmt(libre)} ${NOMBRE_UNIDAD[l.unidad][1]} (${fmt(libreKg)} kg) de este café en la finca.`
                        : `Disponible: ${fmt(libre)} ${NOMBRE_UNIDAD[l.unidad][1]}${l.unidad === "kg" ? "" : ` (${fmt(libreKg)} kg)`}${pedidoKg > 0 ? ` · quedarán ${fmt(libreKg - pedidoKg)} kg` : ""}`}
                    </p>
                  )}
                  {lineas.length > 1 && (
                    <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))} className="text-xs font-medium text-suave hover:text-alerta">Quitar este café</button>
                  )}
                </fieldset>
              );
            })}
            {lineas.length < 3 && conCafe.length > 0 && (
              <button type="button" onClick={() => setLineas((ls) => [...ls, nuevaLinea()])} className="min-h-11 rounded-lg border border-bosque/40 bg-white px-4 text-sm font-semibold text-bosque hover:bg-bosque-claro">
                + Vender otro tipo de café
              </button>
            )}
            {total > 0 && <p className="text-sm">Total de la venta: <span className="font-semibold tabular-nums">{pesos(total)}</span></p>}
          </div>
        )}

        <div className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-fondo/60 px-3 text-sm font-medium has-[:checked]:border-bosque/40 has-[:checked]:bg-bosque-claro">
            <input type="checkbox" name="pagado" checked={pagado} onChange={(e) => setPagado(e.target.checked)} className="size-5 shrink-0 accent-bosque" />
            El comprador ya me pagó
          </label>
          {pagado && (
            <div className="max-w-sm">
              <label htmlFor={`${id}-metodo`} className="mb-1 block text-sm font-medium">¿Cómo le pagó?</label>
              <select id={`${id}-metodo`} name="metodo" className={estiloCampo}>{datos.metodos.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}</select>
              <p className="mt-1 text-xs text-suave">El valor de la venta entra a su billetera.</p>
            </div>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-fondo/60 px-3 text-sm font-medium has-[:checked]:border-bosque/40 has-[:checked]:bg-bosque-claro">
            <input type="checkbox" name="conFlete" checked={conFlete} onChange={(e) => setConFlete(e.target.checked)} className="size-5 shrink-0 accent-bosque" />
            Pagué flete por esta venta
          </label>
          {conFlete && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-flete`} className="mb-1 block text-sm font-medium">Valor del flete (COP)</label>
                <input id={`${id}-flete`} name="flete" inputMode="decimal" className={estiloCampo} />
                <p className="mt-1 text-xs text-suave">Sale de su billetera como gasto de esta venta.</p>
              </div>
              <div>
                <label htmlFor={`${id}-destino`} className="mb-1 block text-sm font-medium">Destino o sector</label>
                <input id={`${id}-destino`} name="destino" placeholder="Cooperativa, municipio…" className={estiloCampo} />
              </div>
            </div>
          )}
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-suave">Agregar detalles (variedad, taza{datos.puedeDescontar ? ", descuento" : ""}, nota)</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div><label htmlFor={`${id}-var`} className="mb-1 block text-sm font-medium">Variedad del café</label><input id={`${id}-var`} name="variedad" className={estiloCampo} /></div>
              <div><label htmlFor={`${id}-taza`} className="mb-1 block text-sm font-medium">Taza o calidad</label><input id={`${id}-taza`} name="taza" className={estiloCampo} /></div>
              {datos.puedeDescontar && <div><label htmlFor={`${id}-desc`} className="mb-1 block text-sm font-medium">Descuento (%)</label><input id={`${id}-desc`} name="descuentoPct" inputMode="decimal" className={estiloCampo} /></div>}
              <div className="sm:col-span-2"><label htmlFor={`${id}-nota`} className="mb-1 block text-sm font-medium">Nota</label><textarea id={`${id}-nota`} name="nota" rows={2} className={`${estiloCampo} py-2`} /></div>
            </div>
          </details>
        </div>

        <button disabled={pendiente || excede || conCafe.length === 0} className="min-h-11 rounded-lg bg-bosque px-5 text-sm font-semibold text-white shadow-sm hover:bg-bosque/90 disabled:opacity-60">
          {pendiente ? "Guardando…" : "Registrar venta"}
        </button>
        {estado.error && (
          <p role="alert" className="rounded-lg border border-alerta/30 bg-alerta/5 p-3 text-sm font-medium text-alerta">
            {estado.error}{estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
          </p>
        )}
      </form>

      <aside className="h-fit rounded-xl border border-borde bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Café de esta finca, ahora</h2>
        {conCafe.length === 0 && enProceso.length === 0 ? (
          <p className="mt-2 text-sm text-suave">No hay café en bodega. Registre una recolección primero.</p>
        ) : (
          <ul className="mt-3 divide-y divide-borde text-sm">
            {conCafe.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span className="text-tinta/85">{p.nombre}</span>
                <span className="whitespace-nowrap text-right font-semibold tabular-nums">{fmt(disponibleKg(p.id))} kg<span className="block text-xs font-normal text-suave">{fmt(disponibleKg(p.id) / factor("arroba"), 1)} @</span></span>
              </li>
            ))}
            {enProceso.map((x) => (
              <li key={x.nombre} className="flex justify-between gap-3 py-2 text-ambar">
                <span>{x.nombre} · aún no se vende</span>
                <span className="whitespace-nowrap font-semibold tabular-nums">{fmt(x.kg)} kg</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-suave">1 arroba = {fmt(factor("arroba"))} kg · 1 carga = {fmt(factor("carga"))} kg (cámbielo en Ajustes).</p>
      </aside>
    </div>
  );
}
