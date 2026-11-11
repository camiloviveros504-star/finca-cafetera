"use client";

import { useActionState, useState } from "react";
import { accionAjuste, accionReverso, accionTraslado, accionTransformacion } from "./acciones";

interface Opciones {
  fincas: { id: string; nombre: string }[];
  lotes: { id: string; fincaId: string; codigo: string; nombre: string }[];
  bodegas: { id: string; fincaId: string; nombre: string }[];
  productos: { id: string; codigo: string; nombre: string }[];
}

const campo = "min-h-11 w-full rounded-lg border-2 border-cafe/40 bg-white px-3 text-base focus:border-cafetal";
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

function Mensaje({ estado }: { estado: { ok?: boolean; error?: string; mensaje?: string; campos?: Record<string, string> } }) {
  if (estado.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-cereza sm:col-span-2">
        {estado.error}
        {estado.campos && Object.values(estado.campos).length > 0 ? ` (${Object.values(estado.campos).join(" · ")})` : ""}
      </p>
    );
  }
  return estado.ok ? <p role="status" className="text-sm font-semibold text-cafetal sm:col-span-2">{estado.mensaje}</p> : null;
}

function Selectores({ o, fincaId, setFincaId }: { o: Opciones; fincaId: string; setFincaId: (v: string) => void }) {
  return (
    <>
      <div>
        <label className="mb-1 block text-sm font-semibold">Finca
          <select name="fincaId" className={campo} value={fincaId} onChange={(e) => setFincaId(e.target.value)}>
            {o.fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </label>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold">Lote de origen
          <select name="loteId" className={campo} required>
            {o.lotes.filter((l) => l.fincaId === fincaId).map((l) => <option key={l.id} value={l.id}>{l.codigo} · {l.nombre}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}

export function FormularioAjuste({ o }: { o: Opciones }) {
  const [estado, accion, pendiente] = useActionState(accionAjuste, {});
  const [fincaId, setFincaId] = useState(o.fincas[0]?.id ?? "");
  const [clave] = useState(() => crypto.randomUUID());
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="claveIdempotencia" value={clave} />
      <Selectores o={o} fincaId={fincaId} setFincaId={setFincaId} />
      <label className="block text-sm font-semibold">Bodega
        <select name="bodegaId" className={campo}>{o.bodegas.filter((b) => b.fincaId === fincaId).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Producto
        <select name="productoId" className={campo}>{o.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Tipo
        <select name="tipo" className={campo}><option value="perdida">Pérdida (resta)</option><option value="ajuste">Ajuste</option></select>
      </label>
      <label className="block text-sm font-semibold">Sentido del ajuste
        <select name="sentido" className={campo}><option value="disminucion">Disminución</option><option value="aumento">Aumento</option></select>
      </label>
      <label className="block text-sm font-semibold">Cantidad (kg)
        <input name="cantidad" inputMode="decimal" required className={campo} />
      </label>
      <label className="block text-sm font-semibold sm:col-span-2">Motivo
        <input name="motivo" required minLength={3} className={campo} placeholder="Ej.: grano brocado, conteo físico" />
      </label>
      <button disabled={pendiente} className="min-h-11 rounded-lg bg-cafetal px-4 font-bold text-white disabled:opacity-60 sm:col-span-2">Registrar</button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function FormularioTraslado({ o }: { o: Opciones }) {
  const [estado, accion, pendiente] = useActionState(accionTraslado, {});
  const [fincaId, setFincaId] = useState(o.fincas[0]?.id ?? "");
  const [clave] = useState(() => crypto.randomUUID());
  const bodegas = o.bodegas.filter((b) => b.fincaId === fincaId);
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="claveIdempotencia" value={clave} />
      <Selectores o={o} fincaId={fincaId} setFincaId={setFincaId} />
      <label className="block text-sm font-semibold">Desde la bodega
        <select name="bodegaOrigenId" className={campo}>{bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Hacia la bodega
        <select name="bodegaDestinoId" className={campo} defaultValue={bodegas[1]?.id}>{bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Producto
        <select name="productoId" className={campo}>{o.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Cantidad (kg)
        <input name="cantidad" inputMode="decimal" required className={campo} />
      </label>
      <button disabled={pendiente} className="min-h-11 rounded-lg bg-cafetal px-4 font-bold text-white disabled:opacity-60 sm:col-span-2">Trasladar</button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function FormularioTransformacion({ o }: { o: Opciones }) {
  const [estado, accion, pendiente] = useActionState(accionTransformacion, {});
  const [fincaId, setFincaId] = useState(o.fincas[0]?.id ?? "");
  const [clave] = useState(() => crypto.randomUUID());
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="claveIdempotencia" value={clave} />
      <Selectores o={o} fincaId={fincaId} setFincaId={setFincaId} />
      <label className="block text-sm font-semibold">Bodega
        <select name="bodegaId" className={campo}>{o.bodegas.filter((b) => b.fincaId === fincaId).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Tipo de proceso
        <input name="tipo" defaultValue="pergamino_seco_a_excelso" required className={campo} />
      </label>
      <label className="block text-sm font-semibold">Producto que entra
        <select name="productoEntradaId" className={campo}>{o.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Producto que sale
        <select name="productoSalidaId" className={campo} defaultValue={o.productos[2]?.id}>{o.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Cantidad que entra (kg)
        <input name="cantidadEntrada" inputMode="decimal" required className={campo} />
      </label>
      <label className="block text-sm font-semibold">Cantidad que sale (kg)
        <input name="cantidadSalida" inputMode="decimal" required className={campo} />
      </label>
      <label className="block text-sm font-semibold">Fecha
        <input name="fecha" type="date" defaultValue={hoy()} required className={campo} />
      </label>
      <button disabled={pendiente} className="min-h-11 rounded-lg bg-cafetal px-4 font-bold text-white disabled:opacity-60 sm:col-span-2">Registrar transformación</button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function BotonReverso({ movimientoId }: { movimientoId: string }) {
  const [estado, accion, pendiente] = useActionState(accionReverso, {});
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="movimientoId" value={movimientoId} />
      <input name="motivo" aria-label="Motivo del reverso" required minLength={3} placeholder="Motivo" className="min-h-11 rounded-lg border-2 border-cafe/40 bg-white px-2 text-base" />
      <button disabled={pendiente} className="min-h-11 rounded-lg border-2 border-cereza px-3 text-sm font-bold text-cereza">Reversar</button>
      {estado.error && <span role="alert" className="text-xs font-semibold text-cereza">{estado.error}</span>}
      {estado.ok && <span role="status" className="text-xs font-semibold text-cafetal">{estado.mensaje}</span>}
    </form>
  );
}
