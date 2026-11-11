import type { Pool } from "pg";
import type { Transaccion } from "@/shared/dominio/contexto";
import type { Auditor, EntradaAuditoria } from "@/shared/aplicacion/puertos";
import { clienteDe } from "@/shared/infraestructura/baseDatos";

const SQL = `INSERT INTO auditoria (organizacion_id, usuario_id, accion, entidad, entidad_id, resultado, antes, despues, ip)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`;

export class AuditorPg implements Auditor {
  constructor(private readonly pool: Pool) {}

  async registrar(e: EntradaAuditoria, tx?: Transaccion): Promise<void> {
    const valores = [
      e.organizacionId,
      e.usuarioId,
      e.accion,
      e.entidad,
      e.entidadId ?? null,
      e.resultado,
      e.antes === undefined ? null : JSON.stringify(e.antes),
      e.despues === undefined ? null : JSON.stringify(e.despues),
      e.ip ?? null,
    ];
    if (tx) await clienteDe(tx).query(SQL, valores);
    else await this.pool.query(SQL, valores);
  }
}
