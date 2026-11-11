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
  /** Texto corto de ayuda bajo el campo. */
  ayuda?: string;
  /** El campo solo se muestra (y se envía) cuando la casilla con este nombre está marcada. */
  visibleSi?: string;
  /** Título de bloque que se muestra antes de este campo, ocupando todo el ancho. */
  seccion?: string;
  /** Ocupa todo el ancho del formulario. */
  ancho?: "completo";
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
    <div className="rounded-lg border border-ambar/40 bg-ambar/5 p-3 col-span-full">
      <p className="text-sm font-medium">Entregue este enlace a la persona. Se muestra una sola vez{vence ? ` y vence el ${vence}` : ""}.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input readOnly value={enlace} aria-label="Enlace de activación" onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-borde bg-white px-3 font-mono text-xs" />
        <button
          type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* el campo queda seleccionable */ } }}
          className="min-h-11 rounded-lg bg-tinta px-4 text-sm font-semibold text-white"
        >
          {copiado ? "Copiado" : "Copiar enlace"}
        </button>
      </div>
    </div>
  );
}

export const estiloCampo = "min-h-11 w-full rounded-lg border border-[#cdd3d0] bg-white px-3 text-base shadow-sm transition placeholder:text-suave/70 focus:border-bosque focus:outline-none focus:ring-2 focus:ring-bosque/20";

/**
 * Formulario reutilizable para Server Actions. Genera una clave de idempotencia por envío (D1: un reintento por mala
 * conexión no duplica la operación) y la renueva cuando la operación se confirma. Los campos opcionales pueden quedar
 * detrás de una casilla (`visibleSi`) para que el formulario muestre solo lo necesario.
 */
export function FormularioGenerico({
  accion,
  campos,
  boton,
  ocultos = {},
  conClave = false,
  compacto = false,
  columnas = 2,
}: {
  accion: Accion;
  campos: CampoFormulario[];
  boton: string;
  ocultos?: Record<string, string>;
  conClave?: boolean;
  compacto?: boolean;
  /** Columnas en pantallas anchas: 3 sirve para filas de “trabajador · kilos · valor”. */
  columnas?: 2 | 3;
}) {
  const prefijo = useId(); // identificadores únicos aunque haya varios formularios en la misma página
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const envolver: Accion = async (previo, datos) => {
    const r = await accion(previo, datos);
    if (r.ok) setClave(crypto.randomUUID());
    return r;
  };
  const [estado, enviar, pendiente] = useActionState(envolver, {});
  const visibles = campos.filter((c) => !c.visibleSi || marcadas[c.visibleSi]);
  return (
    <form action={enviar} className={compacto ? "flex flex-wrap items-end gap-2" : `grid gap-x-4 gap-y-3 sm:grid-cols-2 ${columnas === 3 ? "lg:grid-cols-3" : ""}`}>
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {conClave && <input type="hidden" name="claveIdempotencia" value={clave} />}
      {visibles.map((c) => {
        const id = `${prefijo}-${c.nombre}`;
        const anchoCompleto = c.ancho === "completo" || c.tipo === "textarea" || c.tipo === "multiple" || c.tipo === "checkbox";
        return (
          <div key={c.nombre} className={`contents`}>
            {c.seccion && !compacto && <p className="mt-2 border-t border-borde pt-4 text-sm font-semibold text-tinta col-span-full">{c.seccion}</p>}
            <div className={`${anchoCompleto && !compacto ? "col-span-full" : ""} ${compacto ? "min-w-40" : ""}`}>
              {c.tipo === "multiple" ? (
                <fieldset className="rounded-lg border border-borde p-3">
                  <legend className="px-1 text-sm font-medium">{c.etiqueta}</legend>
                  <div className="flex flex-col gap-1">
                    {c.opciones?.map((o) => (
                      <span key={o.valor} className="flex min-h-11 items-center gap-3">
                        <input id={`${id}-${o.valor}`} type="checkbox" name={c.nombre} value={o.valor} defaultChecked={c.valorInicial?.split(",").includes(o.valor)} className="size-5 shrink-0 accent-bosque" />
                        <label htmlFor={`${id}-${o.valor}`} className="text-sm">{o.texto}</label>
                      </span>
                    ))}
                  </div>
                </fieldset>
              ) : c.tipo === "checkbox" ? (
                <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-fondo/60 px-3 text-sm font-medium has-[:checked]:border-bosque/40 has-[:checked]:bg-bosque-claro">
                  <input
                    id={id}
                    type="checkbox"
                    name={c.nombre}
                    className="size-5 shrink-0 accent-bosque"
                    required={c.requerido}
                    onChange={(e) => setMarcadas((m) => ({ ...m, [c.nombre]: e.target.checked }))}
                  />
                  {c.etiqueta}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="mb-1 block text-sm font-medium">{c.etiqueta}</label>
                  {c.tipo === "select" ? (
                    <select id={id} name={c.nombre} required={c.requerido} defaultValue={c.valorInicial} className={estiloCampo}>
                      {c.opciones?.map((o) => (
                        <option key={o.valor} value={o.valor}>{o.texto}</option>
                      ))}
                    </select>
                  ) : c.tipo === "textarea" ? (
                    <textarea id={id} name={c.nombre} required={c.requerido} placeholder={c.placeholder} defaultValue={c.valorInicial} rows={2} className={`${estiloCampo} py-2`} />
                  ) : (
                    <input
                      id={id}
                      name={c.nombre}
                      type={c.tipo === "date" ? "date" : c.tipo === "password" ? "password" : "text"}
                      autoComplete={c.tipo === "password" ? "new-password" : undefined}
                      inputMode={c.inputMode ?? (c.tipo === "number" ? "decimal" : undefined)}
                      required={c.requerido}
                      placeholder={c.placeholder}
                      defaultValue={c.valorInicial}
                      className={estiloCampo}
                    />
                  )}
                </>
              )}
              {c.ayuda && <p className="mt-1 text-xs text-suave">{c.ayuda}</p>}
            </div>
          </div>
        );
      })}
      <div className={compacto ? "" : "pt-1 col-span-full"}>
        <button disabled={pendiente} className="min-h-11 rounded-lg bg-bosque px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-bosque/90 disabled:opacity-60">
          {pendiente ? "Guardando…" : boton}
        </button>
      </div>
      {estado.error && (
        <p role="alert" className="rounded-lg border border-alerta/30 bg-alerta/5 p-3 text-sm font-medium text-alerta col-span-full">
          {estado.error}
          {estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
        </p>
      )}
      {estado.ok && <p role="status" className="rounded-lg border border-bosque/30 bg-bosque-claro p-3 text-sm font-medium text-bosque col-span-full">{estado.mensaje}</p>}
      {estado.ok && estado.enlace && <EnlaceCopiable enlace={estado.enlace} vence={estado.enlaceVence} />}
    </form>
  );
}
