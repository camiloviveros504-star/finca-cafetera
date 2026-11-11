"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { listarCola, sincronizar, type OperacionCola } from "../_cliente/colaOffline";

function suscribirseARed(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

interface EstadoSync {
  enLinea: boolean;
  cola: OperacionCola[];
  pendientes: number;
  sincronizando: boolean;
  recargar: () => Promise<void>;
  sincronizarAhora: () => Promise<void>;
}

const Contexto = createContext<EstadoSync | null>(null);

export function useSync(): EstadoSync {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSync debe usarse dentro de ProveedorSync");
  return c;
}

export function ProveedorSync({ csrfToken, children }: { csrfToken: string; children: React.ReactNode }) {
  const enLinea = useSyncExternalStore(suscribirseARed, () => navigator.onLine, () => true);
  const [cola, setCola] = useState<OperacionCola[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  const recargar = useCallback(async () => setCola(await listarCola().catch(() => [])), []);

  const sincronizarAhora = useCallback(async () => {
    setSincronizando(true);
    try {
      await sincronizar(csrfToken, true);
    } finally {
      setSincronizando(false);
      await recargar();
    }
  }, [csrfToken, recargar]);

  useEffect(() => {
    listarCola().then(setCola).catch(() => undefined);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    // Al volver la red se sincroniza de inmediato (QA-08: 50 registros en ≤ 60 s).
    const alConectar = () => void sincronizarAhora();
    window.addEventListener("online", alConectar);
    // Los formularios sin conexión avisan con este evento después de guardar en la cola local.
    window.addEventListener("finca-sincronizar", alConectar);
    const temporizador = setInterval(() => {
      if (navigator.onLine) void sincronizar(csrfToken).then(recargar);
    }, 15_000);
    if (navigator.onLine) void sincronizar(csrfToken).then(recargar);
    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("finca-sincronizar", alConectar);
      clearInterval(temporizador);
    };
  }, [csrfToken, recargar, sincronizarAhora]);

  const valor = useMemo<EstadoSync>(
    () => ({ enLinea, cola, pendientes: cola.filter((o) => o.estado === "pendiente").length, sincronizando, recargar, sincronizarAhora }),
    [enLinea, cola, sincronizando, recargar, sincronizarAhora],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Indicador siempre visible del estado de conexión y de la cola. */
export function IndicadorSync() {
  const { enLinea, pendientes, sincronizando } = useSync();
  const texto = !enLinea
    ? `Sin conexión${pendientes ? ` · ${pendientes} pendiente${pendientes === 1 ? "" : "s"}` : ""}`
    : sincronizando
      ? "Sincronizando…"
      : pendientes
        ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"} de sincronizar`
        : "En línea";
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="indicador-sync"
      className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-bold ${
        !enLinea ? "bg-cereza text-white" : pendientes ? "bg-dorado text-cafe" : "bg-white/15 text-white"
      }`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${enLinea ? "bg-green-300" : "bg-white"}`} />
      {texto}
    </span>
  );
}
