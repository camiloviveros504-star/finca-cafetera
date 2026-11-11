import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { ConsultaAuditoria, FilaAuditoria, FiltroAuditoria } from "../domain/consulta";

export class ConsultaAuditoriaPg implements ConsultaAuditoria {
  async listar(tx: Transaccion, organizacionId: string, f: FiltroAuditoria, limite: number, desplazamiento: number) {
    const c = clienteDe(tx);
    const donde = `a.organizacion_id = $1 AND ($2::text IS NULL OR a.resultado = $2) AND ($3::text IS NULL OR a.accion ILIKE $3) AND ($4::text IS NULL OR a.entidad = $4)`;
    const params = [organizacionId, f.resultado || null, f.accion ? `%${f.accion.replace(/[%_]/g, "")}%` : null, f.entidad || null];
    const total = await c.query(`SELECT count(*)::int AS n FROM auditoria a WHERE ${donde}`, params);
    const r = await c.query(
      `SELECT a.id, a.creado_en::text AS fecha, u.nombre AS usuario, a.accion, a.entidad, a.entidad_id, a.resultado, coalesce(a.despues, a.antes)::text AS detalle, a.ip
         FROM auditoria a LEFT JOIN usuario u ON u.id = a.usuario_id WHERE ${donde} ORDER BY a.id DESC LIMIT $5 OFFSET $6`,
      [...params, limite, desplazamiento],
    );
    const filas: FilaAuditoria[] = r.rows.map((x) => ({ id: String(x.id), fecha: x.fecha, usuario: x.usuario, accion: x.accion, entidad: x.entidad, entidadId: x.entidad_id, resultado: x.resultado, detalle: x.detalle, ip: x.ip }));
    return { filas, total: total.rows[0].n as number };
  }
}
