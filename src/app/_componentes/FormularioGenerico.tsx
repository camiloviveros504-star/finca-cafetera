"use client";

import { useActionState, useId, useState } from "react";

export interface CampoFormulario {
  nombre: string;
  etiqueta: string;
  tipo?: "text" | "number" | "date" | "select" | "textarea" | "checkbox" | "multiple" | "password";
  opciones?: { valor: string; texto: string }[];
  requerido?: boolean;
  placeholder?: string;
  valorInicial?: string;
  inputMode?: "decimal" | "numeric" | "text";
}

interface Estado {
  ok?: boolean;
  error?: string;
  mensaje?: string;
  campos?: Record<string, string>;
  enlace?: string;
  enlaceVence?: string;
}
type Accion = (previo: Estado, datos: FormData) => Promise<Estado>;

function EnlaceCopiable({ enlace, vence }: { enlace: string; vence?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rounded-lg border border-ambar/60 bg-ambar/10 p-3 sm:col-span-2">
      <p className="text-sm font-semibold">Entregue este enlace a la persona. Se muestra una sola vez{vence ? ` y vence el ${vence}` : ""}.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input readOnly value={enlace} aria-label="Enlace de activación" onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-tinta/30 bg-white px-3 font-mono text-xs" />
        <button
          type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* el campo queda seleccionable */ } }}
          className="min-h-11 rounded-lg bg-tinta px-4 text-sm font-bold text-white"
        >
          {copiado ? "Copiado" : "Copiar enlace"}
        </button>
      </div>
    </div>
  );
}

const campoBase = "min-h-11 w-full rounded-lg border-2 border-tinta/40 bg-white px-3 text-base focus:border-bosque";

/**
 * Formulario reutilizable para Server Actions. Genera una clave de idempotencia por envío (D1: un reintento por mala
 * conexión no duplica la operación) y la renueva cuando la operación se confirma.
 */
export function FormularioGenerico({
  accion,
  campos,
  boton,
  ocultos = {},
  conClave = false,
  compacto = false,
}: {
  accion: Accion;
  campos: CampoFormulario[];
  boton: string;
  ocultos?: Record<string, string>;
  conClave?: boolean;
  compacto?: boolean;
}) {
  const prefijo = useId(); // identificadores únicos aunque haya varios formularios en la misma página
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const envolver: Accion = async (previo, datos) => {
    const r = await accion(previo, datos);
    if (r.ok) setClave(crypto.randomUUID());
    return r;
  };
  const [estado, enviar, pendiente] = useActionState(envolver, {});
  return (
    <form action={enviar} className={compacto ? "flex flex-wrap items-end gap-2" : "grid gap-3 sm:grid-cols-2"}>
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {conClave && <input type="hidden" name="claveIdempotencia" value={clave} />}
      {campos.map((c) => {
        const Env = c.tipo === "multiple" ? "div" : "label";
        return (
        <Env key={c.nombre} className={`block text-sm font-semibold ${c.tipo === "textarea" || c.tipo === "multiple" ? "sm:col-span-2" : ""}`}>
          {c.tipo === "multiple" ? (
            <fieldset className="rounded-lg border-2 border-tinta/30 p-2">
              <legend className="px-1">{c.etiqueta}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {c.opciones?.map((o) => (
                  <span key={o.valor} className="flex min-h-11 items-center gap-2 font-normal">
                    <input id={`${prefijo}-${c.nombre}-${o.valor}`} type="checkbox" name={c.nombre} value={o.valor} defaultChecked={c.valorInicial?.split(",").includes(o.valor)} className="size-5" />
                    <label htmlFor={`${prefijo}-${c.nombre}-${o.valor}`}>{o.texto}</label>
                  </span>
                ))}
              </div>
            </fieldset>
          ) : c.tipo === "checkbox" ? (
            <span className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name={c.nombre} className="size-5" required={c.requerido} />
              {c.etiqueta}
            </span>
          ) : (
            <>
              {c.etiqueta}
              {c.tipo === "select" ? (
                <select name={c.nombre} required={c.requerido} defaultValue={c.valorInicial} className={campoBase}>
                  {c.opciones?.map((o) => (
                    <option key={o.valor} value={o.valor}>{o.texto}</option>
                  ))}
                </select>
              ) : c.tipo === "textarea" ? (
                <textarea name={c.nombre} required={c.requerido} placeholder={c.placeholder} defaultValue={c.valorInicial} rows={2} className={`${campoBase} py-2`} />
              ) : (
                <input
                  name={c.nombre}
                  type={c.tipo === "date" ? "date" : c.tipo === "password" ? "password" : "text"}
                  autoComplete={c.tipo === "password" ? "new-password" : undefined}
                  inputMode={c.inputMode ?? (c.tipo === "number" ? "decimal" : undefined)}
                  required={c.requerido}
                  placeholder={c.placeholder}
                  defaultValue={c.valorInicial}
                  className={campoBase}
                />
              )}
            </>
          )}
        </Env>
        );
      })}
      <button disabled={pendiente} className="min-h-11 self-end rounded-lg bg-bosque px-4 font-bold text-white disabled:opacity-60">
        {pendiente ? "Guardando…" : boton}
      </button>
      {estado.error && (
        <p role="alert" className="text-sm font-semibold text-alerta sm:col-span-2">
          {estado.error}
          {estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
        </p>
      )}
      {estado.ok && <p role="status" className="text-sm font-semibold text-bosque sm:col-span-2">{estado.mensaje}</p>}
      {estado.ok && estado.enlace && <EnlaceCopiable enlace={estado.enlace} vence={estado.enlaceVence} />}
    </form>
  );
}
