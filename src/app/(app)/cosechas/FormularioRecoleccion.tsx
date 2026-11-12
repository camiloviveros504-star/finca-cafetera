"use client";

import { useActionState, useId, useState } from "react";
import { estiloCampo } from "../../_componentes/FormularioGenerico";

interface Estado {
  ok?: boolean;
  error?: string;
  mensaje?: string;
  campos?: Record<string, string>;
}
type Accion = (previo: Estado, datos: FormData) => Promise<Estado>;
type Fila = { clave: string; trabajadorId: string; kg: string; precio: string };

const nuevaFila = (): Fila => ({ clave: crypto.randomUUID(), trabajadorId: "", kg: "", precio: "" });
const numero = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const kilos = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);

/**
 * Recolección del día. El café siempre se recoge rojo. Dos formas de anotarlo:
 *  · Kilos totales: solo el total recogido en el lote.
 *  · Por trabajador: cada trabajador con sus kilos y el valor del kilo (queda lo que se le debe), más los kilos que
 *    recogió alguien sin registro (el dueño, un familiar o un amigo que ayudó), que suman al lote sin generar pago.
 */
export function FormularioRecoleccion({
  accion,
  lotes,
  trabajadores,
  hoy,
}: {
  accion: Accion;
  lotes: { valor: string; texto: string }[];
  trabajadores: { id: string; nombre: string }[];
  hoy: string;
}) {
  const id = useId();
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const [modo, setModo] = useState<"total" | "trabajador">(trabajadores.length > 0 ? "trabajador" : "total");
  const [filas, setFilas] = useState<Fila[]>([nuevaFila()]);
  const [sinTrabajador, setSinTrabajador] = useState("");
  const [total, setTotal] = useState("");
  const [conFlete, setConFlete] = useState(false);

  const envolver: Accion = async (previo, datos) => {
    const r = await accion(previo, datos);
    if (r.ok) {
      setClave(crypto.randomUUID());
      setFilas([nuevaFila()]);
      setSinTrabajador("");
      setTotal("");
    }
    return r;
  };
  const [estado, enviar, pendiente] = useActionState(envolver, {});

  const conTrabajador = filas.filter((f) => f.trabajadorId);
  const kgTrabajadores = conTrabajador.reduce((a, f) => a + numero(f.kg), 0);
  const aPagar = conTrabajador.reduce((a, f) => a + numero(f.kg) * numero(f.precio), 0);
  const totalLote = modo === "total" ? numero(total) : kgTrabajadores + numero(sinTrabajador);
  const cambiar = (clave: string, campo: keyof Fila, valor: string) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));

  return (
    <form action={enviar} className="space-y-5">
      <input type="hidden" name="claveIdempotencia" value={clave} />
      <input type="hidden" name="modo" value={modo} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-lote`} className="mb-1 block text-sm font-medium">Lote donde se recogió</label>
          <select id={`${id}-lote`} name="loteId" required className={estiloCampo} defaultValue="">
            <option value="" disabled>Elija el lote…</option>
            {lotes.map((l) => <option key={l.valor} value={l.valor}>{l.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-fecha`} className="mb-1 block text-sm font-medium">Fecha</label>
          <input id={`${id}-fecha`} name="fecha" type="date" required max={hoy} defaultValue={hoy} className={estiloCampo} />
          <p className="mt-1 text-xs text-suave">Hoy o un día anterior; no se puede anotar una recolección futura.</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">¿Cómo quiere anotar los kilos?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ["total", "Kilos totales", "Solo el total recogido en el lote."],
            ["trabajador", "Por trabajador", "Los kilos de cada trabajador y lo que se le paga."],
          ] as const).map(([valor, titulo, detalle]) => (
            <label key={valor} className={`flex min-h-11 cursor-pointer gap-3 rounded-lg border p-3 ${modo === valor ? "border-bosque bg-bosque-claro" : "border-borde bg-white hover:bg-fondo"}`}>
              <input type="radio" name="modoVista" checked={modo === valor} onChange={() => setModo(valor)} className="mt-0.5 size-5 shrink-0 accent-bosque" />
              <span><span className="block text-sm font-semibold">{titulo}</span><span className="text-xs text-suave">{detalle}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {modo === "total" ? (
        <div className="max-w-xs">
          <label htmlFor={`${id}-total`} className="mb-1 block text-sm font-medium">Kilos de café rojo recogidos</label>
          <input id={`${id}-total`} name="kgTotal" inputMode="decimal" required value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" className={estiloCampo} />
        </div>
      ) : (
        <div className="space-y-3">
          {trabajadores.length === 0 && (
            <p className="rounded-lg border border-ambar/40 bg-ambar/5 p-3 text-sm">Todavía no tiene trabajadores registrados. Agréguelos en Equipo, o anote solo los kilos sin trabajador.</p>
          )}
          {filas.map((f, i) => (
            <div key={f.clave} className="grid gap-3 rounded-lg border border-borde bg-fondo/40 p-3 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-end">
              <div>
                <label htmlFor={`${id}-t${i}`} className="mb-1 block text-xs font-medium">Trabajador</label>
                <select id={`${id}-t${i}`} name={`trabajadorId${i}`} value={f.trabajadorId} onChange={(e) => cambiar(f.clave, "trabajadorId", e.target.value)} className={estiloCampo}>
                  <option value="">Elija…</option>
                  {trabajadores.map((w) => <option key={w.id} value={w.id} disabled={filas.some((o) => o.clave !== f.clave && o.trabajadorId === w.id)}>{w.nombre}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-k${i}`} className="mb-1 block text-xs font-medium">Kilos</label>
                <input id={`${id}-k${i}`} name={`kg${i}`} inputMode="decimal" value={f.kg} onChange={(e) => cambiar(f.clave, "kg", e.target.value)} placeholder="0" className={estiloCampo} />
              </div>
              <div>
                <label htmlFor={`${id}-p${i}`} className="mb-1 block text-xs font-medium">Valor del kilo (COP)</label>
                <input id={`${id}-p${i}`} name={`precio${i}`} inputMode="decimal" value={f.precio} onChange={(e) => cambiar(f.clave, "precio", e.target.value)} placeholder="0" className={estiloCampo} />
              </div>
              <button type="button" onClick={() => setFilas((fs) => (fs.length > 1 ? fs.filter((x) => x.clave !== f.clave) : [nuevaFila()]))} className="min-h-11 rounded-lg border border-borde bg-white px-3 text-sm text-suave hover:text-alerta" aria-label={`Quitar fila ${i + 1}`}>
                Quitar
              </button>
            </div>
          ))}
          <input type="hidden" name="filas" value={filas.length} />
          {trabajadores.length > filas.length && (
            <button type="button" onClick={() => setFilas((fs) => [...fs, nuevaFila()])} className="min-h-11 rounded-lg border border-bosque/40 bg-white px-4 text-sm font-semibold text-bosque hover:bg-bosque-claro">
              + Agregar otro trabajador
            </button>
          )}
          <div className="max-w-md rounded-lg border border-borde p-3">
            <label htmlFor={`${id}-sin`} className="mb-1 block text-sm font-medium">Kilos recogidos sin trabajador (opcional)</label>
            <input id={`${id}-sin`} name="kgSinTrabajador" inputMode="decimal" value={sinTrabajador} onChange={(e) => setSinTrabajador(e.target.value)} placeholder="0" className={estiloCampo} />
            <p className="mt-1 text-xs text-suave">Lo que recogió el dueño, un familiar o un amigo que ayudó. Suma al lote; no genera pago.</p>
          </div>
        </div>
      )}

      <div className="grid gap-2 rounded-lg bg-bosque-claro p-4 text-sm sm:grid-cols-3">
        <p><span className="block text-xs text-suave">Entra a la bodega</span><span className="text-lg font-semibold tabular-nums">{kilos(totalLote)} kg</span><span className="block text-xs text-suave">de café rojo</span></p>
        {modo === "trabajador" && <p><span className="block text-xs text-suave">De trabajadores</span><span className="text-lg font-semibold tabular-nums">{kilos(kgTrabajadores)} kg</span></p>}
        {modo === "trabajador" && <p><span className="block text-xs text-suave">Total a pagar</span><span className="text-lg font-semibold tabular-nums">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(aPagar)}</span></p>}
      </div>

      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-fondo/60 px-3 text-sm font-medium has-[:checked]:border-bosque/40 has-[:checked]:bg-bosque-claro">
          <input type="checkbox" name="conFlete" checked={conFlete} onChange={(e) => setConFlete(e.target.checked)} className="size-5 shrink-0 accent-bosque" />
          Hubo flete para llevar este café
        </label>
        {conFlete && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-flete`} className="mb-1 block text-sm font-medium">Valor del flete (COP)</label>
              <input id={`${id}-flete`} name="flete" inputMode="decimal" className={estiloCampo} />
              <p className="mt-1 text-xs text-suave">Sale de su billetera como gasto de este lote.</p>
            </div>
            <div>
              <label htmlFor={`${id}-destino`} className="mb-1 block text-sm font-medium">Hacia dónde</label>
              <input id={`${id}-destino`} name="destinoFlete" placeholder="Beneficiadero, bodega, cooperativa…" className={estiloCampo} />
            </div>
          </div>
        )}
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-suave">Agregar una nota</summary>
          <textarea name="nota" rows={2} className={`${estiloCampo} py-2`} />
        </details>
      </div>

      <button disabled={pendiente} className="min-h-11 rounded-lg bg-bosque px-5 text-sm font-semibold text-white shadow-sm hover:bg-bosque/90 disabled:opacity-60">
        {pendiente ? "Guardando…" : "Registrar recolección"}
      </button>
      {estado.error && (
        <p role="alert" className="rounded-lg border border-alerta/30 bg-alerta/5 p-3 text-sm font-medium text-alerta">
          {estado.error}{estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
        </p>
      )}
      {estado.ok && <p role="status" className="rounded-lg border border-bosque/30 bg-bosque-claro p-3 text-sm font-medium text-bosque">{estado.mensaje}</p>}
    </form>
  );
}
