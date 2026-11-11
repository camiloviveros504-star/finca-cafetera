/**
 * Cola local de cosechas sin conexión (ADR-003). Solo cosechas: las ventas nunca se encolan.
 * Cada operación nace con un UUID (clave de idempotencia). Estados: pendiente → sincronizada | rechazada.
 */
export type EstadoOperacion = "pendiente" | "sincronizada" | "rechazada";

export interface OperacionCola {
  id: string;
  payload: Record<string, string>;
  resumen: string;
  estado: EstadoOperacion;
  mensaje?: string;
  creadaEn: string;
  intentos: number;
  proximoIntento: number;
}

const BD = "finca-cola";
const ALMACEN = "operaciones";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BD, 1);
    peticion.onupgradeneeded = () => peticion.result.createObjectStore(ALMACEN, { keyPath: "id" });
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

async function transaccion<T>(modo: IDBTransactionMode, fn: (a: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir();
  return new Promise<T>((resolver, rechazar) => {
    const tx = bd.transaction(ALMACEN, modo);
    const peticion = fn(tx.objectStore(ALMACEN));
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
    tx.oncomplete = () => bd.close();
  });
}

export const encolar = (op: OperacionCola) => transaccion("readwrite", (a) => a.put(op));
export const listarCola = async (): Promise<OperacionCola[]> =>
  (await transaccion("readonly", (a) => a.getAll() as IDBRequest<OperacionCola[]>)).sort((x, y) => (x.creadaEn < y.creadaEn ? 1 : -1));
export const quitar = (id: string) => transaccion("readwrite", (a) => a.delete(id));

export function nuevaOperacion(payload: Record<string, string>, resumen: string): OperacionCola {
  return {
    id: crypto.randomUUID(),
    payload: { ...payload, claveIdempotencia: "" },
    resumen,
    estado: "pendiente",
    creadaEn: new Date().toISOString(),
    intentos: 0,
    proximoIntento: 0,
  };
}

let sincronizando = false;
const PARALELO = 5;

export interface ResumenSync {
  sincronizadas: number;
  rechazadas: number;
  pendientes: number;
}

/**
 * Envía las operaciones pendientes. Red caída o error del servidor (5xx) → sigue pendiente con espera
 * creciente. Respuesta 4xx (permiso, validación, lote inválido) → rechazada con el motivo (no se pierde).
 */
export async function sincronizar(csrfToken: string, forzar = false): Promise<ResumenSync> {
  if (sincronizando) return { sincronizadas: 0, rechazadas: 0, pendientes: (await listarCola()).filter((o) => o.estado === "pendiente").length };
  sincronizando = true;
  let sincronizadas = 0;
  let rechazadas = 0;
  try {
    const ahora = Date.now();
    const pendientes = (await listarCola()).filter((o) => o.estado === "pendiente" && (forzar || o.proximoIntento <= ahora));
    for (let i = 0; i < pendientes.length; i += PARALELO) {
      await Promise.all(
        pendientes.slice(i, i + PARALELO).map(async (op) => {
          try {
            const r = await fetch("/api/cosechas", {
              method: "POST",
              headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
              body: JSON.stringify({ ...op.payload, claveIdempotencia: op.id }),
            });
            if (r.ok) {
              sincronizadas += 1;
              await encolar({ ...op, estado: "sincronizada", mensaje: undefined });
            } else if (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 429) {
              rechazadas += 1;
              const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
              await encolar({ ...op, estado: "rechazada", mensaje: cuerpo.error ?? "Rechazada por el servidor" });
            } else {
              throw new Error(`HTTP ${r.status}`);
            }
          } catch {
            const intentos = op.intentos + 1;
            await encolar({ ...op, intentos, proximoIntento: Date.now() + Math.min(2 ** intentos * 1000, 60_000) });
          }
        }),
      );
    }
  } finally {
    sincronizando = false;
  }
  const pendientes = (await listarCola()).filter((o) => o.estado === "pendiente").length;
  return { sincronizadas, rechazadas, pendientes };
}
