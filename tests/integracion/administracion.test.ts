import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asignarRolesYFincas,
  cambiarEstadoUsuario,
  cambiarPermisoExtra,
  consultarAuditoria,
  crearEquivalencia,
  crearTemporada,
  crearUsuario,
  crearValorCatalogo,
  ErrorCredenciales,
  ErrorNoAutenticado,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  guardarParametro,
  iniciarSesion,
  listarUsuarios,
  obtenerAjustes,
  obtenerContexto,
  restablecerContrasena,
} from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
let n = 100;
const ip = () => `10.9.0.${(n += 1)}`;
const manana = () => new Date(Date.now() + 86_400_000 + 5 * 3_600_000).toISOString().slice(0, 10);

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("usuarios, roles y permisos", () => {
  it("el administrador crea un usuario: contraseña con Argon2id, nunca en claro, y puede iniciar sesión", async () => {
    const admin = await e.contexto("admin@demo.local");
    const { id } = await crearUsuario(e.servicios.usuarios, admin, { correo: "Nuevo@Demo.local", nombre: "Usuario Nuevo DEMO", contrasena: "ClaveNueva2026", roles: ["supervisor_campo"], fincaIds: [e.ids.finca1], autorizaTratamiento: true });
    const fila = await e.pool.query("SELECT correo, password_hash FROM usuario WHERE id = $1", [id]);
    expect(fila.rows[0].correo).toBe("nuevo@demo.local");
    expect(fila.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(fila.rows[0].password_hash).not.toContain("ClaveNueva2026");
    const sesion = await iniciarSesion(e.servicios.sesion, { correo: "nuevo@demo.local", contrasena: "ClaveNueva2026", ip: ip() });
    const ctx = await obtenerContexto(e.servicios.sesion, sesion.token, ip());
    expect(ctx.roles).toEqual(["supervisor_campo"]);
    expect(ctx.permisos.has("trabajo:validar")).toBe(true);
    expect(ctx.permisos.has("tarifa:modificar")).toBe(false);
    // La auditoría no contiene la contraseña ni el hash.
    const aud = await e.pool.query("SELECT count(*)::int AS n FROM auditoria WHERE despues::text LIKE '%ClaveNueva2026%' OR despues::text LIKE '%argon2%'");
    expect(aud.rows[0].n).toBe(0);
  });

  it("rechaza contraseñas débiles, correos repetidos y fincas ajenas", async () => {
    const admin = await e.contexto("admin@demo.local");
    const base = { correo: "otro@demo.local", nombre: "Otro Usuario DEMO", contrasena: "ClaveNueva2026", roles: ["auditor"], fincaIds: [e.ids.finca1], autorizaTratamiento: true };
    await expect(crearUsuario(e.servicios.usuarios, admin, { ...base, contrasena: "corta1" })).rejects.toThrow(ErrorValidacion);
    await expect(crearUsuario(e.servicios.usuarios, admin, { ...base, contrasena: "sololetrasaqui" })).rejects.toThrow(ErrorValidacion);
    await expect(crearUsuario(e.servicios.usuarios, admin, { ...base, autorizaTratamiento: false })).rejects.toThrow(ErrorValidacion);
    await expect(crearUsuario(e.servicios.usuarios, admin, { ...base, correo: "admin@demo.local" })).rejects.toThrow(/Ya existe/);
    await expect(crearUsuario(e.servicios.usuarios, admin, { ...base, roles: ["rol_inventado"] })).rejects.toThrow(/rol no existe/);
    await expect(crearUsuario(e.servicios.usuarios, admin, { ...base, fincaIds: ["00000000-0000-4000-8000-000000000000"] })).rejects.toThrow(/finca/);
  });

  it("cambiar roles, permisos o estado cierra las sesiones del usuario; desactivar impide el acceso", async () => {
    const admin = await e.contexto("admin@demo.local");
    const sesion = await iniciarSesion(e.servicios.sesion, { correo: "comercial@demo.local", contrasena: "Demo-2026!", ip: ip() });
    await obtenerContexto(e.servicios.sesion, sesion.token, ip());
    const usuarios = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios;
    const comercial = usuarios.find((u) => u.correo === "comercial@demo.local")!;
    await cambiarPermisoExtra(e.servicios.usuarios, admin, { usuarioId: comercial.id, permiso: "inventario:ajustar", otorgar: true });
    await expect(obtenerContexto(e.servicios.sesion, sesion.token, ip())).rejects.toThrow(ErrorNoAutenticado);
    const nueva = await iniciarSesion(e.servicios.sesion, { correo: "comercial@demo.local", contrasena: "Demo-2026!", ip: ip() });
    expect((await obtenerContexto(e.servicios.sesion, nueva.token, ip())).permisos.has("inventario:ajustar")).toBe(true);
    await cambiarEstadoUsuario(e.servicios.usuarios, admin, { usuarioId: comercial.id, activo: false });
    await expect(obtenerContexto(e.servicios.sesion, nueva.token, ip())).rejects.toThrow(ErrorNoAutenticado);
    await expect(iniciarSesion(e.servicios.sesion, { correo: "comercial@demo.local", contrasena: "Demo-2026!", ip: ip() })).rejects.toThrow(ErrorCredenciales);
    await cambiarEstadoUsuario(e.servicios.usuarios, admin, { usuarioId: comercial.id, activo: true });
    await restablecerContrasena(e.servicios.usuarios, admin, { usuarioId: comercial.id, contrasena: "OtraClave2026x" });
    await expect(iniciarSesion(e.servicios.sesion, { correo: "comercial@demo.local", contrasena: "Demo-2026!", ip: ip() })).rejects.toThrow(ErrorCredenciales);
    await expect(iniciarSesion(e.servicios.sesion, { correo: "comercial@demo.local", contrasena: "OtraClave2026x", ip: ip() })).resolves.toBeDefined();
  });

  it("nadie se quita el acceso a sí mismo ni deja la organización sin administrador", async () => {
    const admin = await e.contexto("admin@demo.local");
    const yo = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((u) => u.correo === "admin@demo.local")!;
    await expect(cambiarEstadoUsuario(e.servicios.usuarios, admin, { usuarioId: yo.id, activo: false })).rejects.toThrow(/propio usuario/);
    await expect(asignarRolesYFincas(e.servicios.usuarios, admin, { usuarioId: yo.id, roles: ["auditor"], fincaIds: [e.ids.finca1] })).rejects.toThrow(/administrador/);
  });

  it("solo el administrador gestiona usuarios; el supervisor y el auditor no (403 auditado)", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    await expect(crearUsuario(e.servicios.usuarios, sup, { correo: "x@demo.local", nombre: "No Permitido", contrasena: "ClaveNueva2026", roles: ["auditor"], fincaIds: [e.ids.finca1], autorizaTratamiento: true })).rejects.toThrow(ErrorProhibido);
    const aud = await e.contexto("auditor@demo.local");
    await expect(cambiarEstadoUsuario(e.servicios.usuarios, aud, { usuarioId: "00000000-0000-4000-8000-000000000000", activo: false })).rejects.toThrow(ErrorProhibido);
    const denegados = await consultarAuditoria(e.servicios.auditoria, aud, { resultado: "denegado" }, 1);
    expect(denegados.total).toBeGreaterThanOrEqual(2);
    expect(denegados.filas.every((f) => f.resultado === "denegado")).toBe(true);
    await expect(consultarAuditoria(e.servicios.auditoria, sup, {}, 1)).rejects.toThrow(ErrorProhibido);
  });
});

describe("configuración general (sin valores en el código)", () => {
  it("catálogos configurables: nuevo método de pago utilizable, sin duplicados", async () => {
    const admin = await e.contexto("admin@demo.local");
    await crearValorCatalogo(e.servicios.ajustes, admin, { catalogo: "metodo_pago", codigo: "nequi_demo", nombre: "Billetera digital DEMO" });
    await expect(crearValorCatalogo(e.servicios.ajustes, admin, { catalogo: "metodo_pago", codigo: "nequi_demo", nombre: "Repetido" })).rejects.toThrow(/Ya existe/);
    await expect(crearValorCatalogo(e.servicios.ajustes, admin, { catalogo: "inventado", codigo: "x1", nombre: "Xx" })).rejects.toThrow(ErrorValidacion);
    const a = await obtenerAjustes(e.servicios.ajustes, admin);
    expect(a.catalogos.some((c) => c.codigo === "nequi_demo")).toBe(true);
  });

  it("equivalencias con vigencia: la nueva cierra la anterior, no se reescribe el pasado y solo se convierte lo compatible", async () => {
    const admin = await e.contexto("admin@demo.local");
    await crearEquivalencia(e.servicios.ajustes, admin, { origen: "arroba", destino: "kg", factor: "12.000000", desde: manana() });
    const eq = (await obtenerAjustes(e.servicios.ajustes, admin)).equivalencias.filter((x) => x.origen === "arroba" && x.destino === "kg" && !x.fincaId);
    expect(eq).toHaveLength(2);
    const anterior = eq.find((x) => x.factor === "12.500000")!;
    expect(anterior.hasta).toBe(manana());
    expect(anterior.vigente).toBe(true); // hoy sigue rigiendo 12,5
    await expect(crearEquivalencia(e.servicios.ajustes, admin, { origen: "arroba", destino: "kg", factor: "11", desde: "2020-01-01" })).rejects.toThrow(/pasado/);
    await expect(crearEquivalencia(e.servicios.ajustes, admin, { origen: "kg", destino: "jornada", factor: "2", desde: manana() })).rejects.toThrow(/mismo tipo/);
    // Equivalencia propia de una finca: prevalece sobre la general en esa finca.
    await crearEquivalencia(e.servicios.ajustes, admin, { origen: "carga", destino: "kg", factor: "126", desde: fechaColombia(), fincaId: e.ids.finca1 });
  });

  it("temporadas sin solapamiento y parámetros validados por rango, con valor anterior en la auditoría", async () => {
    const admin = await e.contexto("admin@demo.local");
    await crearTemporada(e.servicios.ajustes, admin, { nombre: "Cosecha principal DEMO", desde: "2026-09-01", hasta: "2026-12-31" });
    await expect(crearTemporada(e.servicios.ajustes, admin, { nombre: "Solapada", desde: "2026-12-01", hasta: "2027-01-31" })).rejects.toThrow(ErrorRegla);
    await guardarParametro(e.servicios.ajustes, admin, { clave: "descuento_maximo_pct", valor: "5" });
    await guardarParametro(e.servicios.ajustes, admin, { clave: "descuento_maximo_pct", valor: "8" });
    await expect(guardarParametro(e.servicios.ajustes, admin, { clave: "descuento_maximo_pct", valor: "150" })).rejects.toThrow(/entre/);
    await expect(guardarParametro(e.servicios.ajustes, admin, { clave: "parametro_inventado", valor: "1" })).rejects.toThrow(/desconocido/);
    const aud = await e.pool.query("SELECT antes, despues FROM auditoria WHERE accion = 'parametro.guardar' AND resultado = 'ok' ORDER BY id DESC LIMIT 1");
    expect(aud.rows[0].antes).toEqual({ valor: "5" });
    expect(aud.rows[0].despues).toMatchObject({ valor: "8" });
  });

  it("el encargado de producción y el responsable de bodega no modifican la configuración", async () => {
    for (const correo of ["produccion@demo.local", "bodega@demo.local"]) {
      const ctx = await e.contexto(correo);
      await expect(crearTemporada(e.servicios.ajustes, ctx, { nombre: "No permitida", desde: "2030-01-01", hasta: "2030-02-01" })).rejects.toThrow(ErrorProhibido);
      await expect(guardarParametro(e.servicios.ajustes, ctx, { clave: "stock_minimo_kg", valor: "10" })).rejects.toThrow(ErrorProhibido);
    }
  });
});
