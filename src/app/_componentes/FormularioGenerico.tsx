"use client";

import { useActionState, useState } from "react";

export interface CampoFormulario {
  nombre: string;
  etiqueta: string;
  tipo?: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
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
}
type Accion = (previo: Estado, datos: FormData) => Promise<Estado>;

const campoBase = "min-h-11 w-full rounded-lg border-2 border-cafe/40 bg-white px-3 text-base focus:border-cafetal";

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
      {campos.map((c) => (
        <label key={c.nombre} className={`block text-sm font-semibold ${c.tipo === "textarea" ? "sm:col-span-2" : ""}`}>
          {c.tipo === "checkbox" ? (
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
                  type={c.tipo === "date" ? "date" : "text"}
                  inputMode={c.inputMode ?? (c.tipo === "number" ? "decimal" : undefined)}
                  required={c.requerido}
                  placeholder={c.placeholder}
                  defaultValue={c.valorInicial}
                  className={campoBase}
                />
              )}
            </>
          )}
        </label>
      ))}
      <button disabled={pendiente} className="min-h-11 self-end rounded-lg bg-cafetal px-4 font-bold text-white disabled:opacity-60">
        {pendiente ? "Guardando…" : boton}
      </button>
      {estado.error && (
        <p role="alert" className="text-sm font-semibold text-cereza sm:col-span-2">
          {estado.error}
          {estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
        </p>
      )}
      {estado.ok && <p role="status" className="text-sm font-semibold text-cafetal sm:col-span-2">{estado.mensaje}</p>}
    </form>
  );
}
