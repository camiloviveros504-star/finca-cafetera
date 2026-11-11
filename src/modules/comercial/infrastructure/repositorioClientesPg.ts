import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { ClienteRegistrado, FilaPedido, NuevoCliente, RepositorioClientesPedidos } from "../domain/puertos";

export class RepositorioClientesPg implements RepositorioClientesPedidos {
  async crearCliente(tx: Transaccion, c: NuevoCliente): Promise<string> {
    const r = await clienteDe(tx).query(
      `INSERT INTO cliente (organizacion_id, nombre, documento, telefono, correo, direccion, autorizo_tratamiento_en)
       VALUES ($1,$2,$3,$4,$5,$6, now()) RETURNING id`,
      [c.organizacionId, c.nombre, c.documento ?? null, c.telefono ?? null, c.correo ?? null, c.direccion ?? null],
    );
    return r.rows[0].id as string;
  }

  async listarClientes(tx: Transaccion, organizacionId: string, busqueda: string | null, limite: number, desplazamiento: number) {
    const c = clienteDe(tx);
    const patron = busqueda ? `%${busqueda.replace(/[%_\\]/g, "\\$&")}%` : null;
    const [filas, total] = await Promise.all([
      c.query(
        `SELECT id, nombre, documento, telefono, correo, direccion, autorizo_tratamiento_en
           FROM cliente WHERE organizacion_id = $1 AND activo AND ($2::text IS NULL OR nombre ILIKE $2)
          ORDER BY lower(nombre) LIMIT $3 OFFSET $4`,
        [organizacionId, patron, limite, desplazamiento],
      ),
      c.query("SELECT count(*)::int AS n FROM cliente WHERE organizacion_id = $1 AND activo AND ($2::text IS NULL OR nombre ILIKE $2)", [organizacionId, patron]),
    ]);
    return {
      filas: filas.rows.map(
        (x): ClienteRegistrado => ({
          id: x.id,
          nombre: x.nombre,
          documento: x.documento,
          telefono: x.telefono,
          correo: x.correo,
          direccion: x.direccion,
          autorizoEn: x.autorizo_tratamiento_en ? (x.autorizo_tratamiento_en as Date).toISOString() : null,
        }),
      ),
      total: total.rows[0].n as number,
    };
  }

  async clienteExiste(tx: Transaccion, organizacionId: string, clienteId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM cliente WHERE id = $1 AND organizacion_id = $2 AND activo", [clienteId, organizacionId]);
    return r.rowCount === 1;
  }

  async productosVendibles(tx: Transaccion, organizacionId: string, ids: string[]): Promise<number> {
    const r = await clienteDe(tx).query("SELECT count(*)::int AS n FROM producto WHERE organizacion_id = $1 AND vendible AND activo AND id = ANY($2::uuid[])", [organizacionId, ids]);
    return r.rows[0].n as number;
  }

  async crearPedido(
    tx: Transaccion,
    p: { organizacionId: string; fincaId: string; clienteId: string; creadoPor: string; nota?: string; items: { productoId: string; cantidad: string }[] },
  ): Promise<string> {
    const c = clienteDe(tx);
    const r = await c.query(
      "INSERT INTO pedido (organizacion_id, finca_id, cliente_id, creado_por, nota) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [p.organizacionId, p.fincaId, p.clienteId, p.creadoPor, p.nota ?? null],
    );
    for (const i of p.items) {
      await c.query("INSERT INTO pedido_detalle (pedido_id, producto_id, cantidad) VALUES ($1,$2,$3)", [r.rows[0].id, i.productoId, i.cantidad]);
    }
    return r.rows[0].id as string;
  }

  async listarPedidos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], limite: number, desplazamiento: number) {
    const c = clienteDe(tx);
    const [filas, total] = await Promise.all([
      c.query(
        `SELECT p.id, p.fecha::text AS fecha, p.estado, cl.nombre AS cliente, f.nombre AS finca,
                (SELECT string_agg(pr.nombre || ' ' || d.cantidad::text || ' kg', ', ') FROM pedido_detalle d JOIN producto pr ON pr.id = d.producto_id WHERE d.pedido_id = p.id) AS resumen
           FROM pedido p JOIN cliente cl ON cl.id = p.cliente_id JOIN finca f ON f.id = p.finca_id
          WHERE p.organizacion_id = $1 AND p.finca_id = ANY($2::uuid[]) ORDER BY p.creado_en DESC LIMIT $3 OFFSET $4`,
        [organizacionId, fincaIds, limite, desplazamiento],
      ),
      c.query("SELECT count(*)::int AS n FROM pedido WHERE organizacion_id = $1 AND finca_id = ANY($2::uuid[])", [organizacionId, fincaIds]),
    ]);
    return {
      filas: filas.rows.map((x): FilaPedido => ({ id: x.id, fecha: x.fecha, estado: x.estado, clienteNombre: x.cliente, fincaNombre: x.finca, resumen: x.resumen ?? "" })),
      total: total.rows[0].n as number,
    };
  }
}
