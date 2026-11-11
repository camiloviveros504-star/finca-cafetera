import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { FilaPermiso, FilaRol, FilaUsuario, RepositorioUsuarios } from "../domain/usuarios";

export class RepositorioUsuariosPg implements RepositorioUsuarios {
  async listarUsuarios(tx: Transaccion, o: string): Promise<FilaUsuario[]> {
    const r = await clienteDe(tx).query(
      `SELECT u.id, u.correo, u.nombre, u.activo, (u.autorizo_tratamiento_en IS NOT NULL) AS autorizo, (u.activada_en IS NULL) AS pendiente,
              EXISTS (SELECT 1 FROM invitacion_usuario i WHERE i.usuario_id = u.id AND i.usada_en IS NULL AND i.expira_en > now()) AS invitacion_vigente,
              coalesce((SELECT array_agg(r.codigo ORDER BY r.codigo) FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id WHERE ur.usuario_id = u.id), '{}') AS roles,
              coalesce((SELECT json_agg(json_build_object('id', f.id, 'nombre', f.nombre) ORDER BY f.nombre) FROM usuario_finca uf JOIN finca f ON f.id = uf.finca_id WHERE uf.usuario_id = u.id), '[]'::json) AS fincas,
              coalesce((SELECT array_agg(p.codigo ORDER BY p.codigo) FROM usuario_permiso_extra x JOIN permiso p ON p.id = x.permiso_id WHERE x.usuario_id = u.id), '{}') AS extras
         FROM usuario u WHERE u.organizacion_id = $1 ORDER BY u.nombre`,
      [o],
    );
    return r.rows.map((x) => ({ id: x.id, correo: x.correo, nombre: x.nombre, activo: x.activo, roles: x.roles, fincas: x.fincas, permisosExtra: x.extras, autorizoTratamiento: x.autorizo, pendiente: x.pendiente, invitacionVigente: x.invitacion_vigente }));
  }
  async listarRoles(tx: Transaccion): Promise<FilaRol[]> {
    const r = await clienteDe(tx).query(
      `SELECT r.codigo, r.nombre, r.es_extension, coalesce(array_agg(p.codigo ORDER BY p.codigo) FILTER (WHERE p.id IS NOT NULL), '{}') AS permisos
         FROM rol r LEFT JOIN rol_permiso rp ON rp.rol_id = r.id LEFT JOIN permiso p ON p.id = rp.permiso_id GROUP BY r.id ORDER BY r.es_extension, r.nombre`,
    );
    return r.rows.map((x) => ({ codigo: x.codigo, nombre: x.nombre, esExtension: x.es_extension, permisos: x.permisos }));
  }
  async listarPermisos(tx: Transaccion): Promise<FilaPermiso[]> {
    return (await clienteDe(tx).query("SELECT codigo, descripcion FROM permiso ORDER BY codigo")).rows;
  }
  async crearUsuario(tx: Transaccion, u: { organizacionId: string; correo: string; nombre: string; hash: string; autoriza: boolean }): Promise<string> {
    const r = await clienteDe(tx).query("INSERT INTO usuario (organizacion_id, correo, nombre, password_hash, autorizo_tratamiento_en, activada_en) VALUES ($1,$2,$3,$4, CASE WHEN $5::boolean THEN now() END, now()) RETURNING id", [u.organizacionId, u.correo, u.nombre, u.hash, u.autoriza]);
    return r.rows[0].id as string;
  }
  async usuarioDeOrganizacion(tx: Transaccion, o: string, usuarioId: string) {
    const r = await clienteDe(tx).query(
      "SELECT u.id, u.activo, u.correo, (u.activada_en IS NOT NULL) AS activada, coalesce((SELECT array_agg(r.codigo) FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id WHERE ur.usuario_id = u.id), '{}') AS roles FROM usuario u WHERE u.id = $1 AND u.organizacion_id = $2 FOR UPDATE OF u",
      [usuarioId, o],
    );
    return r.rows[0] ? { id: r.rows[0].id as string, activo: r.rows[0].activo as boolean, roles: r.rows[0].roles as string[], activada: r.rows[0].activada as boolean, correo: r.rows[0].correo as string } : null;
  }
  async asignarRoles(tx: Transaccion, usuarioId: string, codigos: string[]): Promise<boolean> {
    const c = clienteDe(tx);
    const roles = await c.query("SELECT id FROM rol WHERE codigo = ANY($1::text[])", [codigos]);
    if (roles.rowCount !== new Set(codigos).size) return false;
    await c.query("DELETE FROM usuario_rol WHERE usuario_id = $1", [usuarioId]);
    for (const r of roles.rows) await c.query("INSERT INTO usuario_rol (usuario_id, rol_id) VALUES ($1,$2)", [usuarioId, r.id]);
    return true;
  }
  async asignarFincas(tx: Transaccion, o: string, usuarioId: string, fincaIds: string[]): Promise<boolean> {
    const c = clienteDe(tx);
    const unicas = [...new Set(fincaIds)];
    const ok = await c.query("SELECT count(*)::int AS n FROM finca WHERE organizacion_id = $1 AND id = ANY($2::uuid[])", [o, unicas]);
    if (ok.rows[0].n !== unicas.length) return false;
    await c.query("DELETE FROM usuario_finca WHERE usuario_id = $1", [usuarioId]);
    for (const f of unicas) await c.query("INSERT INTO usuario_finca (usuario_id, finca_id) VALUES ($1,$2)", [usuarioId, f]);
    return true;
  }
  async fijarActivo(tx: Transaccion, usuarioId: string, activo: boolean) {
    await clienteDe(tx).query("UPDATE usuario SET activo = $2 WHERE id = $1", [usuarioId, activo]);
  }
  async cambiarHash(tx: Transaccion, usuarioId: string, hash: string) {
    await clienteDe(tx).query("UPDATE usuario SET password_hash = $2 WHERE id = $1", [usuarioId, hash]);
  }
  async revocarSesiones(tx: Transaccion, usuarioId: string) {
    await clienteDe(tx).query("DELETE FROM sesion WHERE usuario_id = $1", [usuarioId]);
  }
  async permisoExiste(tx: Transaccion, codigo: string) {
    return (await clienteDe(tx).query("SELECT 1 FROM permiso WHERE codigo = $1", [codigo])).rowCount === 1;
  }
  async otorgarPermisoExtra(tx: Transaccion, usuarioId: string, codigo: string) {
    await clienteDe(tx).query("INSERT INTO usuario_permiso_extra (usuario_id, permiso_id) SELECT $1, id FROM permiso WHERE codigo = $2 ON CONFLICT DO NOTHING", [usuarioId, codigo]);
  }
  async revocarPermisoExtra(tx: Transaccion, usuarioId: string, codigo: string) {
    await clienteDe(tx).query("DELETE FROM usuario_permiso_extra WHERE usuario_id = $1 AND permiso_id = (SELECT id FROM permiso WHERE codigo = $2)", [usuarioId, codigo]);
  }
  async crearUsuarioPendiente(tx: Transaccion, u: { organizacionId: string; correo: string; nombre: string; hash: string }): Promise<string> {
    const r = await clienteDe(tx).query("INSERT INTO usuario (organizacion_id, correo, nombre, password_hash, activo, activada_en) VALUES ($1,$2,$3,$4,false,NULL) RETURNING id", [u.organizacionId, u.correo, u.nombre, u.hash]);
    return r.rows[0].id as string;
  }
  async insertarInvitacion(tx: Transaccion, i: { organizacionId: string; usuarioId: string; tipo: "alta" | "restablecimiento"; tokenHash: string; expiraEn: Date; creadaPor: string }) {
    await clienteDe(tx).query("INSERT INTO invitacion_usuario (organizacion_id, usuario_id, tipo, token_hash, expira_en, creada_por) VALUES ($1,$2,$3,$4,$5,$6)", [i.organizacionId, i.usuarioId, i.tipo, i.tokenHash, i.expiraEn, i.creadaPor]);
  }
  async revocarInvitaciones(tx: Transaccion, usuarioId: string) {
    await clienteDe(tx).query("UPDATE invitacion_usuario SET usada_en = now() WHERE usuario_id = $1 AND usada_en IS NULL", [usuarioId]);
  }
  async buscarInvitacion(tx: Transaccion, tokenHash: string) {
    const r = await clienteDe(tx).query(
      "SELECT i.id, i.usuario_id, i.organizacion_id, i.tipo, i.expira_en, i.usada_en, u.correo, u.nombre FROM invitacion_usuario i JOIN usuario u ON u.id = i.usuario_id WHERE i.token_hash = $1 FOR UPDATE OF i",
      [tokenHash],
    );
    const x = r.rows[0];
    return x ? { id: x.id as string, usuarioId: x.usuario_id as string, organizacionId: x.organizacion_id as string, tipo: x.tipo as "alta" | "restablecimiento", expiraEn: x.expira_en as Date, usadaEn: (x.usada_en as Date | null) ?? null, correo: x.correo as string, nombre: x.nombre as string } : null;
  }
  async marcarInvitacionUsada(tx: Transaccion, id: string) {
    await clienteDe(tx).query("UPDATE invitacion_usuario SET usada_en = now() WHERE id = $1", [id]);
  }
  async activarUsuario(tx: Transaccion, usuarioId: string, hash: string, esAlta: boolean) {
    await clienteDe(tx).query(
      "UPDATE usuario SET password_hash = $2, activo = true, activada_en = coalesce(activada_en, now()), autorizo_tratamiento_en = CASE WHEN $3::boolean THEN now() ELSE autorizo_tratamiento_en END WHERE id = $1",
      [usuarioId, hash, esAlta],
    );
  }
  async contarAdministradoresActivos(tx: Transaccion, o: string): Promise<number> {
    const r = await clienteDe(tx).query("SELECT count(*)::int AS n FROM usuario u JOIN usuario_rol ur ON ur.usuario_id = u.id JOIN rol r ON r.id = ur.rol_id WHERE u.organizacion_id = $1 AND u.activo AND r.codigo = 'administrador'", [o]);
    return r.rows[0].n;
  }
}
