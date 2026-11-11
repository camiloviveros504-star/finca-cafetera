"use client";

import { useActionState } from "react";
import { accionCrearPedido } from "./acciones";

interface Props {
  fincas: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}

const campo = "min-h-11 w-full rounded-lg border-2 border-tinta/40 bg-white px-3 text-base focus:border-bosque";

export function FormularioPedido({ fincas, clientes, productos }: Props) {
  const [estado, accion, pendiente] = useActionState(accionCrearPedido, {});
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Finca
        <select name="fincaId" className={campo}>{fincas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Cliente
        <select name="clienteId" className={campo}>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Producto
        <select name="productoId" className={campo}>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Cantidad (kg)
        <input name="cantidad" inputMode="decimal" required className={campo} />
      </label>
      <button disabled={pendiente} className="min-h-11 rounded-lg bg-bosque px-4 font-bold text-white disabled:opacity-60 sm:col-span-2">Registrar pedido</button>
      {estado.error && <p role="alert" className="text-sm font-semibold text-alerta sm:col-span-2">{estado.error}</p>}
      {estado.ok && <p role="status" className="text-sm font-semibold text-bosque sm:col-span-2">{estado.mensaje}</p>}
    </form>
  );
}
