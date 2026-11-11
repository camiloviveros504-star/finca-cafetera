import { randomBytes } from "node:crypto";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearServicios, iniciarSesion, instalarSistema, obtenerContexto, obtenerEstadoInstalacion, ErrorProhibido, ErrorRegla, ErrorValidacion, type Servicios } from "@/composicion";
import { migrar } from "../../db/migrador";

const URL_ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgresql://finca:finca_local@localhost:5433/postgres";
const CODIGO = "codigo-de-instalacion-de-prueba";
const nombreBd = `prueba_${randomBytes(6).toString("hex")}`;
let pool: Pool;
let servicios: Servicios;

const datos = (extra: Record<string, unknown> = {}) => ({
  codigo: CODIGO, organizacion: "Cooperativa La Cumbre", finca: "Finca El Mirador", nombre: "Ana Administradora", correo: "Ana@Cumbre.co", contrasena: "ClaveSegura2026", autorizaTratamiento: true, ...extra,
});

beforeAll(async () => {
  const admin = new Client({ connectionString: URL_ADMIN });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombreBd}`);
  await admin.end();
  const url = URL_ADMIN.replace(/\/[^/]*$/, `/${nombreBd}`);
  const c = new Client({ connectionString: url });
  await c.connect();
  await migrar(c); // solo migraciones: SIN datos de ejemplo
  await c.end();
  pool = new Pool({ connectionString: url, max: 5 });
  servicios = crearServicios(pool, { codigoInstalacion: CODIGO });
}, 120_000);
afterAll(async () => {
  await pool.end();
  const a = new Client({ connectionString: URL_ADMIN });
  await a.connect();
  await a.query(`DROP DATABASE IF EXISTS ${nombreBd} WITH (FORCE)`);
  await a.end();
});

describe("primer arranque (sin datos de ejemplo)", () => {
  it("una base vacía está sin instalar y no hay ninguna organización ni usuario", async () => {
    expect(await obtenerEstadoInstalacion(servicios.instalacion)).toEqual({ instalado: false, habilitada: true });
    expect((await pool.query("SELECT count(*)::int AS n FROM usuario")).rows[0].n).toBe(0);
  });

  it("rechaza un código incorrecto (y lo deja en la auditoría) y datos inválidos", async () => {
    await expect(instalarSistema(servicios.instalacion, datos({ codigo: "otro-codigo-cualquiera" }))).rejects.toThrow(ErrorProhibido);
    await expect(instalarSistema(servicios.instalacion, datos({ contrasena: "corta" }))).rejects.toThrow(ErrorValidacion);
    await expect(instalarSistema(servicios.instalacion, datos({ autorizaTratamiento: false }))).rejects.toThrow(ErrorValidacion);
    expect((await pool.query("SELECT count(*)::int AS n FROM auditoria WHERE accion = 'sistema.instalar' AND resultado = 'denegado'")).rows[0].n).toBe(1);
    expect((await pool.query("SELECT count(*)::int AS n FROM organizacion")).rows[0].n).toBe(0);
  }, 20_000);

  it("instala una sola vez: organización, finca con bodega, administrador, catálogos, productos y flujos, sin valores comerciales", async () => {
    // Dos solicitudes a la vez: solo una instala.
    const r = await Promise.allSettled([instalarSistema(servicios.instalacion, datos()), instalarSistema(servicios.instalacion, datos())]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((r.find((x) => x.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(ErrorRegla);

    const q = async (sql: string) => (await pool.query(sql)).rows[0];
    expect((await q("SELECT count(*)::int AS n FROM organizacion")).n).toBe(1);
    expect((await q("SELECT es_demo FROM organizacion")).es_demo).toBe(false);
    expect((await q("SELECT count(*)::int AS n FROM bodega")).n).toBe(1);
    expect((await q("SELECT count(*)::int AS n FROM producto WHERE NOT es_demo")).n).toBe(7);
    expect((await q("SELECT count(*)::int AS n FROM proceso_etapa")).n).toBe(5);
    // Nada de precios, tarifas, equivalencias, clientes ni trabajadores inventados.
    for (const t of ["tarifa", "tarifa_version", "conversion_unidad", "cliente", "trabajador", "movimiento_inventario", "venta"]) {
      expect((await q(`SELECT count(*)::int AS n FROM ${t}`)).n, t).toBe(0);
    }
    expect(await obtenerEstadoInstalacion(servicios.instalacion)).toEqual({ instalado: true, habilitada: true });
    await expect(instalarSistema(servicios.instalacion, datos({ correo: "otro@cumbre.co" }))).rejects.toThrow(/ya fue instalado/);
  }, 30_000);

  it("el administrador creado puede iniciar sesión y tiene todos los permisos; la contraseña va con Argon2id", async () => {
    const hash = (await pool.query("SELECT password_hash FROM usuario")).rows[0].password_hash as string;
    expect(hash).toMatch(/^\$argon2id\$/);
    const sesion = await iniciarSesion(servicios.sesion, { correo: "ana@cumbre.co", contrasena: "ClaveSegura2026", ip: "10.1.1.1" });
    const ctx = await obtenerContexto(servicios.sesion, sesion.token, "10.1.1.1");
    expect(ctx.roles).toEqual(["administrador"]);
    expect(ctx.permisos.has("usuario:administrar")).toBe(true);
    expect(ctx.fincaIds).toHaveLength(1);
  });

  it("sin CODIGO_INSTALACION definido, la instalación queda deshabilitada", async () => {
    const sinCodigo = crearServicios(pool, { codigoInstalacion: "corto" });
    expect((await obtenerEstadoInstalacion(sinCodigo.instalacion)).habilitada).toBe(false);
  });
});
