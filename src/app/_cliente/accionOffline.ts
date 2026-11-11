import { encolar, nuevaOperacion, type TipoOperacion } from "./colaOffline";

interface Estado {
  ok?: boolean;
  error?: string;
  mensaje?: string;
}

/**
 * Crea la acción de un formulario que guarda primero en la cola local (IndexedDB) y luego intenta enviar. La operación
 * queda como "pendiente" hasta que el servidor la confirme: nunca se muestra como confirmada antes de tiempo.
 * El UUID del formulario es la clave de idempotencia, así un reintento no duplica el registro.
 */
export function crearAccionOffline(tipo: TipoOperacion, resumir: (datos: Record<string, string>) => string) {
  return async (_previo: Estado, formulario: FormData): Promise<Estado> => {
    const payload: Record<string, string> = {};
    for (const [clave, valor] of formulario.entries()) {
      if (typeof valor !== "string") continue;
      payload[clave] = /^\d+,\d+$/.test(valor.trim()) ? valor.trim().replace(",", ".") : valor;
    }
    const id = payload.claveIdempotencia || crypto.randomUUID();
    try {
      await encolar(nuevaOperacion(payload, resumir(payload), tipo, id));
    } catch {
      return { error: "No se pudo guardar en este dispositivo. Intente de nuevo." };
    }
    window.dispatchEvent(new Event("finca-sincronizar"));
    return {
      ok: true,
      mensaje: navigator.onLine
        ? "Guardado. Se está enviando al servidor; mientras no se confirme figura como pendiente en el indicador de arriba."
        : "Guardado en este dispositivo. Figura como PENDIENTE y se enviará cuando vuelva la conexión.",
    };
  };
}
