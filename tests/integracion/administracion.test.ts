import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asignarRolesYFincas,
  cambiarEstadoUsuario,
  cambiarPermisoExtra,
  consultarAuditoria,
  crearEquivalencia,
  crearUsuario,
  crearValorCatalogo,
  ErrorCredenciales,
  ErrorNoAutenticado,
  ErrorProhibido,
  ErrorValidacion,
  guardarParametro,
  iniciarSesion,
  listarUsuarios,
  obtenerAjustes,
  opcionesDeCatalogo,
  registrarGasto,
  cambiarEstadoValorCatalogo,
  ErrorNoEncontrado,
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
    const { id } = await crearUsuario(e.servicios.usuarios, admin, { correo: "Nuevo@Demo.local", nombre: "Usuario Nuevo DEMO", contrasena: "ClaveNueva2026", roles: ["propietario"], fincaIds: [], autorizaTratamiento: true });
    const fila = await e.pool.query("SELECT correo, password_hash FROM usuario WHERE id = $1", [id]);
    expect(fila.rows[0].correo).toBe("nuevo@demo.local");
    expect(fila.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(fila.rows[0].password_hash).not.toContain("ClaveNueva2026");
    const sesion = await iniciarSesion(e.servicios.sesion, { correo: "nuevo@demo.local", contrasena: "ClaveNueva2026", ip: ip() });
    const ctx = await obtenerContexto(e.servicios.sesion, sesion.token, ip());
    expect(ctx.roles).toEqual(["propietario"]);
    expect(ctx.permisos.has("finca:crear")).toBe(true);
    expect(ctx.permisos.has("usuario:administrar")).toBe(false);
    // La auditoría no contiene la contraseña ni el hash.
    const aud = await e.pool.query("SELECT count(*)::int AS n FROM auditoria WHERE despues::text LIKE '%ClaveNueva2026%' OR despues::text LIKE '%argon2%'");
    expect(aud.rows[0].n).toBe(0);
  });

  it("rechaza contraseñas débiles, correos repetidos y que el administrador asigne fincas", async () => {
    const admin = await e.contexto("admin@demo.local");
    const base = { correo: "otro@demo.local", nombre: "Otro Usuario DEMO", contrasena: "ClaveNueva2026", roles: ["propietario"], fincaIds: [] as string[], autorizaTratamiento: true };
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

describe("ajustes de cada finca (los maneja su propietario, no el administrador)", () => {
  it("el propietario agrega un método de pago para su finca y lo usa en su billetera; quien trabaja en otra finca no lo ve", async () => {
    const dueno = await e.contexto("propietario@demo.local"); // finca 1
    const otro = await e.contexto("comercial2@demo.local"); // trabaja en la finca 2
    const r = await crearValorCatalogo(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, catalogo: "metodo_pago", nombre: "Nequi Finca Uno" });
    expect(r.codigo).toBe("nequi_finca_uno");
    await expect(crearValorCatalogo(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, catalogo: "metodo_pago", nombre: "Nequi finca uno" })).rejects.toThrow(/ya existe/);
    await expect(crearValorCatalogo(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, catalogo: "metodo_pago", nombre: "Efectivo" })).rejects.toThrow(/ya existe/); // ya está en la base
    await expect(crearValorCatalogo(e.servicios.ajustes, dueno, { fincaId: e.ids.finca2, catalogo: "metodo_pago", nombre: "Ajeno" })).rejects.toThrow(ErrorProhibido);
    await expect(crearValorCatalogo(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, catalogo: "tipo_cafe", nombre: "Xx" })).rejects.toThrow(ErrorValidacion);

    expect((await opcionesDeCatalogo(e.servicios.ajustes, dueno, "metodo_pago")).map((o) => o.valor)).toContain("nequi_finca_uno");
    expect((await opcionesDeCatalogo(e.servicios.ajustes, otro, "metodo_pago")).map((o) => o.valor)).not.toContain("nequi_finca_uno");
    await registrarGasto(e.servicios.finanzas, dueno, { fincaId: e.ids.finca1, tipo: "flete", clasificacion: "agricola", fecha: fechaColombia(), descripcion: "Flete pagado por Nequi", monto: "10000", metodo: "nequi_finca_uno", claveIdempotencia: randomUUID() });

    // Los valores del sistema no se desactivan; los propios sí.
    const todos = (await obtenerAjustes(e.servicios.ajustes, dueno)).catalogos;
    const base = todos.find((c) => c.codigo === "efectivo" && !c.fincaId)!;
    await expect(cambiarEstadoValorCatalogo(e.servicios.ajustes, dueno, { id: base.id, activo: false })).rejects.toThrow(ErrorNoEncontrado);
    await cambiarEstadoValorCatalogo(e.servicios.ajustes, dueno, { id: r.id, activo: false });
    expect((await opcionesDeCatalogo(e.servicios.ajustes, dueno, "metodo_pago")).map((o) => o.valor)).not.toContain("nequi_finca_uno");
  });

  it("equivalencias de la finca con vigencia: la nueva cierra la anterior y no se reescribe el pasado", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    await crearEquivalencia(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, origen: "carga", destino: "kg", factor: "125", desde: fechaColombia() });
    await crearEquivalencia(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, origen: "carga", destino: "kg", factor: "126", desde: manana() });
    const eq = (await obtenerAjustes(e.servicios.ajustes, dueno)).equivalencias.filter((x) => x.origen === "carga" && x.fincaId === e.ids.finca1);
    expect(eq).toHaveLength(2);
    expect(eq.find((x) => x.factor === "125.000000")!).toMatchObject({ hasta: manana(), vigente: true });
    await expect(crearEquivalencia(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, origen: "carga", destino: "kg", factor: "100", desde: "2020-01-01" })).rejects.toThrow(/pasado/);
    await expect(crearEquivalencia(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, origen: "kg", destino: "jornada", factor: "2", desde: manana() })).rejects.toThrow(/mismo tipo/);
    await expect(crearEquivalencia(e.servicios.ajustes, dueno, { fincaId: e.ids.finca2, origen: "carga", destino: "kg", factor: "120", desde: manana() })).rejects.toThrow(ErrorProhibido);
  });

  it("parámetros de la finca validados por rango, con valor anterior en la auditoría", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    await guardarParametro(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, clave: "descuento_maximo_pct", valor: "5" });
    await guardarParametro(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, clave: "descuento_maximo_pct", valor: "8" });
    await expect(guardarParametro(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, clave: "descuento_maximo_pct", valor: "150" })).rejects.toThrow(/entre/);
    await expect(guardarParametro(e.servicios.ajustes, dueno, { fincaId: e.ids.finca1, clave: "stock_minimo_kg", valor: "1" })).rejects.toThrow(/desconocido/);
    await expect(guardarParametro(e.servicios.ajustes, dueno, { clave: "descuento_maximo_pct", valor: "5" })).rejects.toThrow(ErrorValidacion); // siempre de una finca
    const aud = await e.pool.query("SELECT antes, despues FROM auditoria WHERE accion = 'parametro.guardar' AND resultado = 'ok' ORDER BY id DESC LIMIT 1");
    expect(aud.rows[0].antes).toEqual({ valor: "5" });
    expect(aud.rows[0].despues).toMatchObject({ valor: "8" });
  });

  it("el administrador de la plataforma y el capataz no tocan los ajustes de una finca", async () => {
    for (const correo of ["admin@demo.local", "capataz@demo.local", "bodega@demo.local"]) {
      const ctx = await e.contexto(correo);
      await expect(obtenerAjustes(e.servicios.ajustes, ctx)).rejects.toThrow(ErrorProhibido);
      await expect(guardarParametro(e.servicios.ajustes, ctx, { fincaId: e.ids.finca1, clave: "descuento_maximo_pct", valor: "10" })).rejects.toThrow(ErrorProhibido);
    }
  });
});
