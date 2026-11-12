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
export interface PasoUI { codigo: string; nombre: string; entrada: string; salida: string; mismoPeso: boolean; ayuda: string }
export interface DisponibleUI { fincaId: string; loteId: string; lote: string; estado: string; kg: string }

/** "Rojo (recién recogido)" → "rojo"; "Seco (pergamino)" → "seco"; "En lavado" → "en lavado". */
const corto = (nombre?: string) => (nombre ?? "").split(" (")[0].toLowerCase();
const kilos = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);
const numero = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Avanza café de un estado al siguiente: elige el paso y el lote, y anota los kilos que entran y los que quedan. */
export function FormularioPaso({ accion, pasos, nombres, disponibles, hoy, pasoInicial }: {
  accion: Accion;
  pasos: PasoUI[];
  nombres: Record<string, string>;
  disponibles: DisponibleUI[];
  hoy: string;
  pasoInicial?: string;
}) {
  const id = useId();
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const conCafe = (p: PasoUI) => disponibles.some((d) => d.estado === p.entrada);
  const [codigo, setCodigo] = useState(pasoInicial ?? pasos.find(conCafe)?.codigo ?? pasos[0].codigo);
  const paso = pasos.find((p) => p.codigo === codigo) ?? pasos[0];
  const lotes = disponibles.filter((d) => d.estado === paso.entrada);
  const [loteId, setLoteId] = useState("");
  const lote = lotes.find((l) => l.loteId === loteId) ?? (lotes.length === 1 ? lotes[0] : undefined);
  const [entrada, setEntrada] = useState("");
  const [salida, setSalida] = useState("");

  const envolver: Accion = async (previo, datos) => {
    const r = await accion(previo, datos);
    if (r.ok) {
      setClave(crypto.randomUUID());
      setEntrada("");
      setSalida("");
    }
    return r;
  };
  const [estado, enviar, pendiente] = useActionState(envolver, {});
  const kgEntrada = numero(entrada);
  const kgSalida = paso.mismoPeso ? kgEntrada : numero(salida);
  const rendimiento = kgEntrada > 0 && kgSalida > 0 ? Math.round((kgSalida / kgEntrada) * 1000) / 10 : null;

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="claveIdempotencia" value={clave} />
      <input type="hidden" name="fincaId" value={lote?.fincaId ?? ""} />

      <div>
        <label htmlFor={`${id}-paso`} className="mb-1 block text-sm font-medium">¿Qué le hizo al café?</label>
        <select id={`${id}-paso`} name="paso" value={codigo} onChange={(e) => { setCodigo(e.target.value); setLoteId(""); setEntrada(""); setSalida(""); }} className={estiloCampo}>
          {pasos.map((p) => (
            <option key={p.codigo} value={p.codigo}>{p.nombre}: {corto(nombres[p.entrada])} → {corto(nombres[p.salida])}{conCafe(p) ? "" : " (no hay café para este paso)"}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-suave">{paso.ayuda}</p>
      </div>

      {lotes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borde p-3 text-sm text-suave">No hay café {corto(nombres[paso.entrada])} en la bodega para este paso.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-lote`} className="mb-1 block text-sm font-medium">Lote de origen</label>
              <select id={`${id}-lote`} name="loteId" required value={lote?.loteId ?? ""} onChange={(e) => setLoteId(e.target.value)} className={estiloCampo}>
                {lotes.length > 1 && <option value="" disabled>Elija el lote…</option>}
                {lotes.map((l) => <option key={l.loteId} value={l.loteId}>{l.lote} · {kilos(Number(l.kg))} kg</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-fecha`} className="mb-1 block text-sm font-medium">Fecha</label>
              <input id={`${id}-fecha`} name="fecha" type="date" required max={hoy} defaultValue={hoy} className={estiloCampo} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-entra`} className="mb-1 block text-sm font-medium">Kilos de café {corto(nombres[paso.entrada])} que entran</label>
              <div className="flex gap-2">
                <input id={`${id}-entra`} name="kgEntrada" inputMode="decimal" required value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="0" className={estiloCampo} />
                {lote && (
                  <button type="button" onClick={() => setEntrada(String(Number(lote.kg)))} className="min-h-11 shrink-0 rounded-lg border border-borde bg-white px-3 text-sm font-medium hover:bg-fondo">Todo</button>
                )}
              </div>
              {lote && <p className="mt-1 text-xs text-suave">Disponible en este lote: {kilos(Number(lote.kg))} kg</p>}
            </div>
            {paso.mismoPeso ? (
              <p className="self-end rounded-lg bg-fondo p-3 text-sm text-suave">El peso no cambia: los mismos kilos pasan a café {corto(nombres[paso.salida])}.</p>
            ) : (
              <div>
                <label htmlFor={`${id}-sale`} className="mb-1 block text-sm font-medium">Kilos de café {corto(nombres[paso.salida])} que quedaron</label>
                <input id={`${id}-sale`} name="kgSalida" inputMode="decimal" required value={salida} onChange={(e) => setSalida(e.target.value)} placeholder="0" className={estiloCampo} />
                {rendimiento !== null && <p className={`mt-1 text-xs ${kgSalida > kgEntrada ? "font-semibold text-alerta" : "text-suave"}`}>{kgSalida > kgEntrada ? "No puede quedar más de lo que entró" : `Rendimiento: ${rendimiento} % · se perdieron ${kilos(kgEntrada - kgSalida)} kg`}</p>}
              </div>
            )}
          </div>

          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-suave">Agregar una nota</summary>
            <textarea name="nota" rows={2} className={`${estiloCampo} py-2`} placeholder="Secador, patio, humedad, observaciones…" />
          </details>

          <button disabled={pendiente} className="min-h-11 rounded-lg bg-bosque px-5 text-sm font-semibold text-white shadow-sm hover:bg-bosque/90 disabled:opacity-60">
            {pendiente ? "Guardando…" : `Registrar: ${paso.nombre.toLowerCase()}`}
          </button>
        </>
      )}
      {estado.error && (
        <p role="alert" className="rounded-lg border border-alerta/30 bg-alerta/5 p-3 text-sm font-medium text-alerta">
          {estado.error}{estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
        </p>
      )}
      {estado.ok && <p role="status" className="rounded-lg border border-bosque/30 bg-bosque-claro p-3 text-sm font-medium text-bosque">{estado.mensaje}</p>}
    </form>
  );
}
