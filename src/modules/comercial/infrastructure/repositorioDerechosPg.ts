import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { CamposRectificables, DatosCliente, RepositorioDerechosCliente } from "../domain/derechos";

export class RepositorioDerechosPg implements RepositorioDerechosCliente {
  async obtener(tx: Transaccion, o: string, id: string): Promise<DatosCliente | null> {
    const r = await clienteDe(tx).query(
      "SELECT id, nombre, documento, telefono, correo, direccion, finalidad_tratamiento, autorizo_tratamiento_en::text AS autorizo, activo, anonimizado_en::text AS anonimizado, creado_en::text AS creado FROM cliente WHERE id = $1 AND organizacion_id = $2 FOR UPDATE",
      [id, o],
    );
    const x = r.rows[0];
    return x ? { id: x.id, nombre: x.nombre, documento: x.documento, telefono: x.telefono, correo: x.correo, direccion: x.direccion, finalidad: x.finalidad_tratamiento, autorizoEn: x.autorizo, activo: x.activo, anonimizadoEn: x.anonimizado, creadoEn: x.creado } : null;
  }

  async resumenComercial(tx: Transaccion, o: string, id: string) {
    const c = clienteDe(tx);
    const v = await c.query("SELECT count(*)::int AS n, coalesce(sum(total) FILTER (WHERE estado = 'confirmada'), 0) AS total FROM venta WHERE cliente_id = $1 AND organizacion_id = $2", [id, o]);
    const p = await c.query("SELECT count(*)::int AS n FROM pedido WHERE cliente_id = $1 AND organizacion_id = $2", [id, o]);
    return { ventas: v.rows[0].n as number, total: v.rows[0].total as string, pedidos: p.rows[0].n as number };
  }

  async actualizar(tx: Transaccion, o: string, id: string, campos: CamposRectificables): Promise<void> {
    const sets: string[] = [];
    const valores: unknown[] = [id, o];
    for (const [columna, valor] of Object.entries({ nombre: campos.nombre, telefono: campos.telefono, correo: campos.correo, direccion: campos.direccion })) {
      if (valor === undefined) continue;
      valores.push(valor);
      sets.push(`${columna} = $${valores.length}`);
    }
    if (sets.length === 0) return;
    await clienteDe(tx).query(`UPDATE cliente SET ${sets.join(", ")} WHERE id = $1 AND organizacion_id = $2`, valores);
  }

  async anonimizar(tx: Transaccion, o: string, id: string): Promise<void> {
    await clienteDe(tx).query(
      "UPDATE cliente SET nombre = 'Cliente anonimizado', documento = NULL, telefono = NULL, correo = NULL, direccion = NULL, activo = false, anonimizado_en = now() WHERE id = $1 AND organizacion_id = $2",
      [id, o],
    );
  }
}
