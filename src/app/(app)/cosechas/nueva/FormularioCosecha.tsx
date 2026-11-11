"use client";

import { useMemo, useState } from "react";
import { encolar, nuevaOperacion } from "../../../_cliente/colaOffline";
import { useSync } from "../../../_componentes/ProveedorSync";

interface Opciones {
  fincas: { id: string; nombre: string }[];
  lotes: { id: string; fincaId: string; codigo: string; nombre: string }[];
  bodegas: { id: string; fincaId: string; nombre: string }[];
  productos: { id: string; codigo: string; nombre: string; unidadId: string }[];
  unidades: { id: string; codigo: string; nombre: string }[];
}

const campo = "min-h-12 w-full rounded-lg border border-[#cdd3d0] bg-white px-3 text-base focus:border-bosque";
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

/** Flujo de 4 pasos pensado para celular y una mano: finca y lote → fecha → cantidad y unidad → confirmar. */
export function FormularioCosecha({ opciones }: { opciones: Opciones; csrfToken: string }) {
  const sync = useSync();
  const [paso, setPaso] = useState(1);
  const [fincaId, setFincaId] = useState(opciones.fincas[0]?.id ?? "");
  const lotes = useMemo(() => opciones.lotes.filter((l) => l.fincaId === fincaId), [opciones.lotes, fincaId]);
  const [loteId, setLoteId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const productosCosecha = opciones.productos;
  const [productoId, setProductoId] = useState(productosCosecha.find((p) => p.codigo === "CER")?.id ?? productosCosecha[0]?.id ?? "");
  const kg = opciones.unidades.find((u) => u.codigo === "kg");
  const [unidadId, setUnidadId] = useState(kg?.id ?? opciones.unidades[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const [guardada, setGuardada] = useState(false);

  const loteElegido = lotes.find((l) => l.id === loteId);
  const bodega = opciones.bodegas.find((b) => b.fincaId === fincaId);

  function avanzar() {
    setError("");
    if (paso === 1 && !loteId) return setError("Seleccione el lote de origen");
    if (paso === 2 && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setError("Indique una fecha válida");
    if (paso === 3) {
      if (!/^\d{1,11}([.,]\d{1,3})?$/.test(cantidad.trim()) || Number(cantidad.replace(",", ".")) <= 0) {
        return setError("Escriba una cantidad mayor que cero (máximo 3 decimales)");
      }
    }
    setPaso((p) => p + 1);
  }

  async function guardar() {
    if (!bodega) return setError("La finca no tiene bodega configurada");
    const unidad = opciones.unidades.find((u) => u.id === unidadId)?.codigo ?? "";
    const op = nuevaOperacion(
      {
        fincaId,
        loteId,
        bodegaId: bodega.id,
        productoId,
        unidadId,
        fecha,
        cantidad: cantidad.trim().replace(",", "."),
        capturadaEn: new Date().toISOString(),
      },
      `Lote ${loteElegido?.codigo} · ${cantidad} ${unidad} · ${fecha}`,
    );
    await encolar(op);
    await sync.recargar();
    setGuardada(true);
    if (navigator.onLine) void sync.sincronizarAhora();
  }

  function otra() {
    setPaso(1);
    setCantidad("");
    setLoteId("");
    setGuardada(false);
    setError("");
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-3 text-sm font-bold" aria-live="polite">
        Paso {Math.min(paso, 4)} de 4
      </p>
      <div className="space-y-4 rounded-xl border border-borde shadow-sm bg-white p-4">
        {paso === 1 && (
          <>
            <div>
              <label htmlFor="finca" className="mb-1 block font-semibold">Finca</label>
              <select id="finca" className={campo} value={fincaId} onChange={(e) => { setFincaId(e.target.value); setLoteId(""); }}>
                {opciones.fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lote" className="mb-1 block font-semibold">Lote de origen</label>
              <select id="lote" className={campo} value={loteId} onChange={(e) => setLoteId(e.target.value)}>
                <option value="">Seleccione…</option>
                {lotes.map((l) => <option key={l.id} value={l.id}>{l.codigo} · {l.nombre}</option>)}
              </select>
            </div>
          </>
        )}
        {paso === 2 && (
          <div>
            <label htmlFor="fecha" className="mb-1 block font-semibold">Fecha de la cosecha</label>
            <input id="fecha" type="date" className={campo} value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} />
          </div>
        )}
        {paso === 3 && (
          <>
            <div>
              <label htmlFor="producto" className="mb-1 block font-semibold">Producto</label>
              <select id="producto" className={campo} value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                {productosCosecha.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cantidad" className="mb-1 block font-semibold">Cantidad</label>
                <input id="cantidad" inputMode="decimal" autoComplete="off" placeholder="0" className={campo} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
              </div>
              <div>
                <label htmlFor="unidad" className="mb-1 block font-semibold">Unidad</label>
                <select id="unidad" className={campo} value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                  {opciones.unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
        {paso === 4 && !guardada && (
          <dl className="space-y-2 text-base">
            <div><dt className="text-sm font-bold">Lote</dt><dd>{loteElegido?.codigo} · {loteElegido?.nombre}</dd></div>
            <div><dt className="text-sm font-bold">Fecha</dt><dd>{fecha}</dd></div>
            <div><dt className="text-sm font-bold">Cantidad</dt><dd>{cantidad} {opciones.unidades.find((u) => u.id === unidadId)?.nombre}</dd></div>
          </dl>
        )}
        {paso === 4 && guardada && (
          <div role="status" className="space-y-3">
            <p className="text-base font-semibold">
              {sync.enLinea ? "Cosecha guardada. Enviando al servidor…" : "Cosecha guardada en este dispositivo."}
            </p>
            <p className="text-sm">
              Aparece como <strong>pendiente</strong> hasta que el servidor la confirme. No cuenta en el inventario antes de eso.
            </p>
            <button onClick={otra} className="min-h-12 w-full rounded-lg bg-bosque px-4 font-bold text-white">
              Registrar otra cosecha
            </button>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-alerta/40 p-3 text-sm font-semibold text-alerta">{error}</p>}
      </div>

      {!(paso === 4 && guardada) && (
        <div className="fixed inset-x-0 bottom-14 z-20 flex gap-3 bg-fondo/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:mt-4 lg:bg-transparent lg:p-0">
          {paso > 1 && (
            <button onClick={() => setPaso(paso - 1)} className="min-h-12 flex-1 rounded-lg border border-[#cdd3d0] bg-white px-4 font-semibold hover:bg-fondo">
              Atrás
            </button>
          )}
          {paso < 4 ? (
            <button onClick={avanzar} className="min-h-12 flex-[2] rounded-lg bg-bosque px-4 font-bold text-white">
              Continuar
            </button>
          ) : (
            <button onClick={guardar} className="min-h-12 flex-[2] rounded-lg bg-bosque px-4 font-bold text-white">
              Guardar cosecha
            </button>
          )}
        </div>
      )}

      <section className="mt-6 pb-24" aria-labelledby="titulo-cola">
        <h2 id="titulo-cola" className="mb-2 font-semibold">Mis registros recientes</h2>
        {sync.cola.length === 0 ? (
          <p className="text-sm">Todavía no hay registros en este dispositivo.</p>
        ) : (
          <ul className="space-y-2">
            {sync.cola.slice(0, 10).map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 rounded-lg border border-borde shadow-sm bg-white p-3 text-sm">
                <span>{o.resumen}{o.mensaje && <span className="block font-semibold text-alerta">{o.mensaje}</span>}</span>
                <span
                  data-estado={o.estado}
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                    o.estado === "sincronizada" ? "bg-bosque text-white" : o.estado === "rechazada" ? "bg-alerta text-white" : "bg-ambar text-tinta"
                  }`}
                >
                  {o.estado === "sincronizada" ? "Confirmada" : o.estado === "rechazada" ? "Rechazada" : "Pendiente"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
