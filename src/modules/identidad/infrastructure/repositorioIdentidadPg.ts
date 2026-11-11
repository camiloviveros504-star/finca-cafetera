import type { Pool } from "pg";
import type { RepositorioIdentidad, SesionActiva, UsuarioRegistrado } from "../domain/puertos";

export class RepositorioIdentidadPg implements RepositorioIdentidad {
  constructor(private readonly pool: Pool) {}

  async buscarUsuarioPorCorreo(correo: string): Promise<UsuarioRegistrado | null> {
    const r = await this.pool.query(
      "SELECT id, organizacion_id, nombre, correo, password_hash, activo FROM usuario WHERE lower(correo) = lower($1)",
      [correo],
    );
    const f = r.rows[0];
    if (!f) return null;
    return {
      id: f.id,
      organizacionId: f.organizacion_id,
      nombre: f.nombre,
      correo: f.correo,
      passwordHash: f.password_hash,
      activo: f.activo,
    };
  }

  async contarFallosPorCorreo(correoHash: string, desde: Date): Promise<number> {
    const r = await this.pool.query(
      "SELECT count(*)::int AS n FROM intento_acceso WHERE correo_hash = $1 AND NOT exitoso AND creado_en >= $2",
      [correoHash, desde],
    );
    return r.rows[0].n;
  }

  async contarFallosPorIp(ip: string, desde: Date): Promise<number> {
    const r = await this.pool.query(
      "SELECT count(*)::int AS n FROM intento_acceso WHERE ip = $1 AND NOT exitoso AND creado_en >= $2",
      [ip, desde],
    );
    return r.rows[0].n;
  }

  async registrarIntento(correoHash: string, ip: string, exitoso: boolean): Promise<void> {
    await this.pool.query("INSERT INTO intento_acceso (correo_hash, ip, exitoso) VALUES ($1,$2,$3)", [correoHash, ip, exitoso]);
  }

  async crearSesion(tokenHash: string, usuarioId: string, expiraEn: Date, csrfToken: string): Promise<void> {
    await this.pool.query("INSERT INTO sesion (token_hash, usuario_id, expira_en, csrf_token) VALUES ($1,$2,$3,$4)", [
      tokenHash,
      usuarioId,
      expiraEn,
      csrfToken,
    ]);
  }

  async buscarSesion(tokenHash: string): Promise<SesionActiva | null> {
    const s = await this.pool.query(
      `SELECT u.id, u.organizacion_id, u.nombre, u.correo, s.csrf_token
         FROM sesion s JOIN usuario u ON u.id = s.usuario_id
        WHERE s.token_hash = $1 AND s.expira_en > now() AND u.activo`,
      [tokenHash],
    );
    const f = s.rows[0];
    if (!f) return null;
    const [roles, permisos, fincas] = await Promise.all([
      this.pool.query("SELECT r.codigo FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id WHERE ur.usuario_id = $1", [f.id]),
      this.pool.query(
        `SELECT p.codigo FROM usuario_rol ur JOIN rol_permiso rp ON rp.rol_id = ur.rol_id JOIN permiso p ON p.id = rp.permiso_id WHERE ur.usuario_id = $1
         UNION
         SELECT p.codigo FROM usuario_permiso_extra e JOIN permiso p ON p.id = e.permiso_id WHERE e.usuario_id = $1`,
        [f.id],
      ),
      this.pool.query("SELECT finca_id FROM usuario_finca WHERE usuario_id = $1", [f.id]),
    ]);
    return {
      contexto: {
        usuarioId: f.id,
        organizacionId: f.organizacion_id,
        nombre: f.nombre,
        correo: f.correo,
        csrfToken: f.csrf_token,
        roles: roles.rows.map((r) => r.codigo as string),
        permisos: new Set(permisos.rows.map((r) => r.codigo as string)),
        fincaIds: fincas.rows.map((r) => r.finca_id as string),
      },
    };
  }

  async eliminarSesion(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sesion WHERE token_hash = $1", [tokenHash]);
  }
}
