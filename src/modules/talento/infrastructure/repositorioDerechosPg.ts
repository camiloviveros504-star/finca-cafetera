import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { DatosTrabajador, RepositorioDerechosTrabajador } from "../domain/derechos";

export class RepositorioDerechosTrabajadorPg implements RepositorioDerechosTrabajador {
  async obtener(tx: Transaccion, o: string, id: string): Promise<DatosTrabajador | null> {
    const r = await clienteDe(tx).query(
      "SELECT id, usuario_id, tipo_documento, numero_documento, nombres, apellidos, telefono, finalidad_tratamiento, autorizo_tratamiento_en::text AS autorizo, anonimizado_en::text AS anonimizado FROM trabajador WHERE id = $1 AND organizacion_id = $2 FOR UPDATE",
      [id, o],
    );
    const x = r.rows[0];
    return x ? { id: x.id, usuarioId: x.usuario_id, tipoDocumento: x.tipo_documento, numeroDocumento: x.numero_documento, nombres: x.nombres, apellidos: x.apellidos, telefono: x.telefono, finalidad: x.finalidad_tratamiento, autorizoEn: x.autorizo, anonimizadoEn: x.anonimizado } : null;
  }

  async resumenLaboral(tx: Transaccion, o: string, id: string) {
    const c = clienteDe(tx);
    const w = await c.query("SELECT count(*)::int AS n FROM registro_trabajo WHERE trabajador_id = $1 AND organizacion_id = $2", [id, o]);
    const l = await c.query("SELECT count(*)::int AS n FROM liquidacion WHERE trabajador_id = $1 AND organizacion_id = $2", [id, o]);
    const a = await c.query("SELECT count(*)::int AS n FROM anticipo WHERE trabajador_id = $1 AND organizacion_id = $2", [id, o]);
    return { registros: w.rows[0].n as number, liquidaciones: l.rows[0].n as number, anticipos: a.rows[0].n as number };
  }

  async actualizar(tx: Transaccion, o: string, id: string, campos: { nombres?: string; apellidos?: string; telefono?: string | null }): Promise<void> {
    const sets: string[] = [];
    const valores: unknown[] = [id, o];
    for (const [columna, valor] of Object.entries(campos)) {
      if (valor === undefined) continue;
      valores.push(valor);
      sets.push(`${columna} = $${valores.length}`);
    }
    if (sets.length === 0) return;
    await clienteDe(tx).query(`UPDATE trabajador SET ${sets.join(", ")} WHERE id = $1 AND organizacion_id = $2`, valores);
  }

  async anonimizar(tx: Transaccion, o: string, id: string): Promise<void> {
    await clienteDe(tx).query(
      "UPDATE trabajador SET nombres = 'Trabajador', apellidos = 'anonimizado', numero_documento = 'ANON-' || left(id::text, 8), telefono = NULL, activo = false, anonimizado_en = now() WHERE id = $1 AND organizacion_id = $2",
      [id, o],
    );
  }
}
