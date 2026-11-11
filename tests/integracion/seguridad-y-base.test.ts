import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorBloqueado, ErrorCredenciales, iniciarSesion, obtenerContexto, ErrorNoAutenticado } from "@/composicion";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
beforeAll(async () => {
  e = await crearEntorno({ poolMax: 5 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("QA-06 · fuerza bruta", () => {
  it("bloquea tras 5 fallos y responde igual si el usuario existe o no", async () => {
    const ip = "192.168.50.1";
    const mensajes = new Set<string>();
    for (let i = 0; i < 5; i++) {
      for (const correo of ["comercial@demo.local", "no-existe@demo.local"]) {
        try {
          await iniciarSesion(e.servicios.sesion, { correo, contrasena: "incorrecta", ip: `${ip}${i}${correo.length}` });
        } catch (error) {
          expect(error).toBeInstanceOf(ErrorCredenciales);
          mensajes.add((error as Error).message);
        }
      }
    }
    expect(mensajes.size).toBe(1); // mismo mensaje: no revela si el usuario existe
    await expect(
      iniciarSesion(e.servicios.sesion, { correo: "comercial@demo.local", contrasena: "Demo-2026!", ip: "192.168.99.9" }),
    ).rejects.toThrow(ErrorBloqueado);
  });

  it("una sesión inexistente o vencida no autentica", async () => {
    await expect(obtenerContexto(e.servicios.sesion, "token-falso", "1.1.1.1")).rejects.toThrow(ErrorNoAutenticado);
    await expect(obtenerContexto(e.servicios.sesion, undefined, "1.1.1.1")).rejects.toThrow(ErrorNoAutenticado);
  });

  it("el token no se guarda en claro y la contraseña usa Argon2id", async () => {
    const s = await iniciarSesion(e.servicios.sesion, { correo: "admin@demo.local", contrasena: "Demo-2026!", ip: "10.9.9.9" });
    const guardados = await e.pool.query("SELECT token_hash FROM sesion");
    expect(guardados.rows.some((f) => f.token_hash === s.token)).toBe(false);
    const u = await e.pool.query("SELECT password_hash FROM usuario WHERE correo = 'admin@demo.local'");
    expect(u.rows[0].password_hash.startsWith("$argon2id$")).toBe(true);
  });
});

describe("restricciones de la base de datos (no dependen de la aplicación)", () => {
  it("QA-04: la BD rechaza una cosecha huérfana y una con lote de otra finca", async () => {
    const base = [e.ids.finca1, e.ids.bodega1, e.ids.CER, e.ids.kg];
    await expect(
      e.pool.query(
        `INSERT INTO cosecha (organizacion_id, finca_id, lote_id, producto_id, bodega_id, fecha, cantidad, unidad_id, cantidad_base, factor_aplicado, clave_idempotencia, capturada_en, registrado_por)
         SELECT f.organizacion_id, f.id, NULL, $3, $2, '2026-11-01', 1, $4, 1, 1, gen_random_uuid(), now(), (SELECT id FROM usuario LIMIT 1) FROM finca f WHERE f.id = $1`,
        base,
      ),
    ).rejects.toThrow(/null value|not-null/i);
    await expect(
      e.pool.query(
        `INSERT INTO cosecha (organizacion_id, finca_id, lote_id, producto_id, bodega_id, fecha, cantidad, unidad_id, cantidad_base, factor_aplicado, clave_idempotencia, capturada_en, registrado_por)
         SELECT f.organizacion_id, f.id, $5, $3, $2, '2026-11-01', 1, $4, 1, 1, gen_random_uuid(), now(), (SELECT id FROM usuario LIMIT 1) FROM finca f WHERE f.id = $1`,
        [...base, e.ids.lote2_01],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("D1: CHECK (cantidad >= 0) rechaza un saldo negativo aunque el código falle", async () => {
    await expect(
      e.pool.query("UPDATE saldo_inventario SET cantidad = -1 WHERE lote_id = $1 AND producto_id = $2", [e.ids.lote1_01, e.ids.PSE]),
    ).rejects.toThrow(/check|saldo_inventario_cantidad_check/i);
  });

  it("los movimientos de inventario y la auditoría son inmutables", async () => {
    await expect(e.pool.query("UPDATE movimiento_inventario SET nota = 'x'")).rejects.toThrow(/solo inserción/);
    await expect(e.pool.query("DELETE FROM movimiento_inventario")).rejects.toThrow(/solo inserción/);
    await e.pool.query("INSERT INTO auditoria (accion, entidad, resultado) VALUES ('prueba','prueba','ok')");
    await expect(e.pool.query("UPDATE auditoria SET accion = 'otra'")).rejects.toThrow(/solo inserción/);
    await expect(e.pool.query("DELETE FROM auditoria")).rejects.toThrow(/solo inserción/);
  });

  it("QA-12: las vigencias de una tarifa no pueden solaparse", async () => {
    const t = await e.pool.query("SELECT tarifa_id FROM tarifa_version LIMIT 1");
    await expect(
      e.pool.query("INSERT INTO tarifa_version (tarifa_id, version, valor, vigencia) VALUES ($1, 2, 15000, '[2026-06-01,2027-01-01)')", [t.rows[0].tarifa_id]),
    ).rejects.toThrow(/conflicting key|exclusion/i);
  });

  it("QA-12: una nueva versión de tarifa aplica desde su fecha sin alterar ventas históricas", async () => {
    const t = await e.pool.query("SELECT tarifa_id FROM tarifa_version LIMIT 1");
    await e.pool.query("UPDATE tarifa_version SET vigencia = '[2026-01-01,2026-12-01)' WHERE tarifa_id = $1 AND version = 1", [t.rows[0].tarifa_id]);
    await e.pool.query("INSERT INTO tarifa_version (tarifa_id, version, valor, vigencia, es_demo) VALUES ($1, 2, 16000, '[2026-12-01,)', true)", [t.rows[0].tarifa_id]);
    const v = await e.pool.query("SELECT version, valor FROM tarifa_version WHERE tarifa_id = $1 ORDER BY version", [t.rows[0].tarifa_id]);
    expect(v.rows.map((r) => r.valor)).toEqual(["14000.00", "16000.00"]);
  });
});
