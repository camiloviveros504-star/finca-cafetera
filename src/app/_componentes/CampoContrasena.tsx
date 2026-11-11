"use client";

import { useId, useState } from "react";

function fortaleza(v: string): { nivel: number; texto: string } {
  if (!v) return { nivel: 0, texto: "" };
  let puntos = 0;
  if (v.length >= 10) puntos++;
  if (v.length >= 14) puntos++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) puntos++;
  if (/\d/.test(v)) puntos++;
  if (/[^A-Za-z0-9]/.test(v)) puntos++;
  const nivel = Math.min(Math.max(puntos - 1, 1), 4);
  return { nivel, texto: ["", "Débil", "Aceptable", "Buena", "Muy buena"][nivel] };
}

/**
 * Campo de contraseña: botón para mostrar u ocultar, aviso de bloqueo de mayúsculas y, si se pide, indicador de fortaleza.
 * No guarda ni envía la contraseña a ningún lado distinto del formulario.
 */
export function CampoContrasena({
  nombre, etiqueta, autoComplete, conFortaleza = false, onCambio,
}: { nombre: string; etiqueta: string; autoComplete: "current-password" | "new-password"; conFortaleza?: boolean; onCambio?: (v: string) => void }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [valor, setValor] = useState("");
  const f = fortaleza(valor);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{etiqueta}</label>
      <div className="relative">
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <input
          id={id}
          name={nombre}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          spellCheck={false}
          autoCapitalize="none"
          value={valor}
          onChange={(e) => { setValor(e.target.value); onCambio?.(e.target.value); }}
          onKeyUp={(e) => setMayusculas(e.getModifierState("CapsLock"))}
          onBlur={() => setMayusculas(false)}
          className="min-h-12 w-full rounded-lg border border-tinta/30 bg-white pl-10 pr-12 text-base shadow-sm focus:border-bosque focus:outline-none focus:ring-2 focus:ring-bosque/30"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-tinta/60 hover:bg-arena hover:text-tinta"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {visible ? (<><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12 12 0 0 1-2.2 3M6.5 6.8C4.3 8.2 2.8 10.3 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>) : (<><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="3" /></>)}
          </svg>
        </button>
      </div>
      {mayusculas && <p role="status" className="mt-1.5 text-sm font-semibold text-alerta">Bloq Mayús está activado.</p>}
      {conFortaleza && valor && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= f.nivel ? (f.nivel <= 1 ? "bg-alerta" : f.nivel === 2 ? "bg-ambar" : "bg-bosque") : "bg-tinta/15"}`} />)}
          </div>
          <p className="mt-1 text-xs text-tinta/75">Fortaleza: {f.texto}. Mínimo 10 caracteres, con letras y números.</p>
        </div>
      )}
    </div>
  );
}
