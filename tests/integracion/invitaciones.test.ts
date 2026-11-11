import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  activarCuenta,
  cambiarEstadoUsuario,
  consultarInvitacion,
  emitirEnlace,
  ErrorBloqueado,
  ErrorCredenciales,
  ErrorNoAutenticado,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  invitarUsuario,
  iniciarSesion,
  listarUsuarios,
  obtenerContexto,
  vincularUsuarioATrabajador,
} from "@/composicion";
import { sha256 } from "@/shared/aplicacion/cripto";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
let n = 0;
const ip = () => `10.7.0.${(n += 1)}`;
const CLAVE = "MiClaveNueva2026";

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
});
afterAll(async () => {
  await e.cerrar();
});

const invitar = async (correo: string, roles = ["recolector"]) => {
  const admin = await e.contexto("admin@demo.local");
  return invitarUsuario(e.servicios.invitaciones, admin, { correo, nombre: "Persona Invitada DEMO", roles, fincaIds: [e.ids.finca1] });
};
const activar = (token: string, extra: Record<string, unknown> = {}) =>
  activarCuenta(e.servicios.invitaciones, { token, contrasena: CLAVE, confirmacion: CLAVE, aceptaTratamiento: true, ip: ip(), ...extra });

describe("alta de usuarios por invitación (todo parte del administrador)", () => {
  it("el administrador define los roles; la persona fija su propia contraseña y entra con los permisos de su rol", async () => {
    const inv = await invitar("nueva.persona@finca.co");
    // Antes de activar no puede entrar: la cuenta existe pero nadie conoce una contraseña.
    await expect(iniciarSesion(e.servicios.sesion, { correo: "nueva.persona@finca.co", contrasena: CLAVE, ip: ip() })).rejects.toThrow(ErrorCredenciales);
    const fila = (await e.pool.query("SELECT activo, activada_en, autorizo_tratamiento_en FROM usuario WHERE correo = 'nueva.persona@finca.co'")).rows[0];
    expect(fila).toMatchObject({ activo: false, activada_en: null, autorizo_tratamiento_en: null });

    const info = await consultarInvitacion(e.servicios.invitaciones, inv.token, ip());
    expect(info).toMatchObject({ valida: true, tipo: "alta" });
    expect(JSON.stringify(info)).not.toContain("nueva.persona@finca.co"); // el correo sale enmascarado

    await activar(inv.token);
    const sesion = await iniciarSesion(e.servicios.sesion, { correo: "nueva.persona@finca.co", contrasena: CLAVE, ip: ip() });
    const ctx = await obtenerContexto(e.servicios.sesion, sesion.token, ip());
    expect(ctx.roles).toEqual(["recolector"]);
    expect(ctx.permisos.has("trabajo:registrar_propio")).toBe(true);
    expect(ctx.permisos.has("venta:crear")).toBe(false);
    const despues = (await e.pool.query("SELECT activo, autorizo_tratamiento_en, password_hash FROM usuario WHERE correo = 'nueva.persona@finca.co'")).rows[0];
    expect(despues.activo).toBe(true);
    expect(despues.autorizo_tratamiento_en).not.toBeNull();
    expect(despues.password_hash).toMatch(/^\$argon2id\$/);
  });

  it("solo el administrador invita; supervisor y auditor reciben 403 y queda auditado", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    await expect(invitarUsuario(e.servicios.invitaciones, sup, { correo: "x@finca.co", nombre: "No Permitido", roles: ["auditor"], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorProhibido);
    await expect(emitirEnlace(e.servicios.invitaciones, sup, { usuarioId: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow(ErrorProhibido);
    const denegados = (await e.pool.query("SELECT count(*)::int AS n FROM auditoria WHERE resultado = 'denegado' AND accion IN ('usuario.invitar','usuario.enlace')")).rows[0].n;
    expect(denegados).toBeGreaterThanOrEqual(2);
  });

  it("el enlace es de un solo uso: reutilizarlo falla, y solo se guarda su huella (nunca el token)", async () => {
    const inv = await invitar("un.solo.uso@finca.co", ["bodega"].map((r) => (r === "bodega" ? "responsable_bodega" : r)));
    const guardado = (await e.pool.query("SELECT token_hash FROM invitacion_usuario i JOIN usuario u ON u.id = i.usuario_id WHERE u.correo = 'un.solo.uso@finca.co'")).rows[0].token_hash;
    expect(guardado).toBe(sha256(inv.token));
    expect(guardado).not.toContain(inv.token);
    await activar(inv.token);
    await expect(activar(inv.token, { contrasena: "OtraClave2026xx", confirmacion: "OtraClave2026xx" })).rejects.toThrow(/no es válido o ya venció/);
    expect((await consultarInvitacion(e.servicios.invitaciones, inv.token, ip())).valida).toBe(false);
    // La contraseña original sigue funcionando: el segundo intento no cambió nada.
    await expect(iniciarSesion(e.servicios.sesion, { correo: "un.solo.uso@finca.co", contrasena: CLAVE, ip: ip() })).resolves.toBeDefined();
  });

  it("dos activaciones simultáneas con el mismo enlace: solo una prospera", async () => {
    const inv = await invitar("carrera@finca.co", ["auditor"]);
    const r = await Promise.allSettled(Array.from({ length: 6 }, () => activar(inv.token)));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("un enlace vencido, uno inventado y uno revocado se rechazan igual (sin revelar cuál es el motivo)", async () => {
    const inv = await invitar("vencido@finca.co", ["auditor"]);
    await e.pool.query("UPDATE invitacion_usuario SET expira_en = now() - interval '1 minute' WHERE token_hash = $1", [sha256(inv.token)]);
    await expect(activar(inv.token)).rejects.toThrow(/no es válido o ya venció/);
    await expect(activar("t".repeat(43))).rejects.toThrow(/no es válido o ya venció/);

    const otra = await invitar("revocado@finca.co", ["auditor"]);
    const admin = await e.contexto("admin@demo.local");
    const usuarioId = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((u) => u.correo === "revocado@finca.co")!.id;
    const nuevo = await emitirEnlace(e.servicios.invitaciones, admin, { usuarioId });
    await expect(activar(otra.token)).rejects.toThrow(/no es válido o ya venció/); // el anterior quedó revocado
    await expect(activar(nuevo.token)).resolves.toBeDefined();
  });

  it("rechaza contraseñas débiles, distintas o sin aceptar el tratamiento de datos", async () => {
    const inv = await invitar("debil@finca.co", ["auditor"]);
    await expect(activar(inv.token, { contrasena: "corta1", confirmacion: "corta1" })).rejects.toThrow(ErrorValidacion);
    await expect(activar(inv.token, { contrasena: "password12345", confirmacion: "password12345" })).rejects.toThrow(ErrorValidacion);
    await expect(activar(inv.token, { contrasena: "debil2026abcd", confirmacion: "debil2026abcd" })).rejects.toThrow(ErrorValidacion); // contiene su usuario de correo
    await expect(activar(inv.token, { confirmacion: "OtraDistinta2026" })).rejects.toThrow(/no coinciden/);
    await expect(activar(inv.token, { aceptaTratamiento: false })).rejects.toThrow(ErrorValidacion);
    await expect(activar(inv.token)).resolves.toBeDefined(); // tras los intentos fallidos el enlace sigue sirviendo
  });

  it("el restablecimiento cierra las sesiones abiertas y el enlace anterior ya no sirve", async () => {
    const admin = await e.contexto("admin@demo.local");
    const usuarioId = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((u) => u.correo === "un.solo.uso@finca.co")!.id;
    const sesion = await iniciarSesion(e.servicios.sesion, { correo: "un.solo.uso@finca.co", contrasena: CLAVE, ip: ip() });
    await obtenerContexto(e.servicios.sesion, sesion.token, ip());
    const enlace = await emitirEnlace(e.servicios.invitaciones, admin, { usuarioId });
    expect(enlace.tipo).toBe("restablecimiento");
    await activar(enlace.token, { contrasena: "ClaveRestablecida2026", confirmacion: "ClaveRestablecida2026", aceptaTratamiento: false });
    await expect(obtenerContexto(e.servicios.sesion, sesion.token, ip())).rejects.toThrow(ErrorNoAutenticado);
    await expect(iniciarSesion(e.servicios.sesion, { correo: "un.solo.uso@finca.co", contrasena: CLAVE, ip: ip() })).rejects.toThrow(ErrorCredenciales);
    await expect(iniciarSesion(e.servicios.sesion, { correo: "un.solo.uso@finca.co", contrasena: "ClaveRestablecida2026", ip: ip() })).resolves.toBeDefined();
  });

  it("adivinar enlaces desde una misma IP se bloquea (comparte el límite del inicio de sesión)", async () => {
    const atacante = "10.66.66.66";
    let bloqueado = false;
    for (let i = 0; i < 25 && !bloqueado; i++) {
      try {
        await consultarInvitacion(e.servicios.invitaciones, `adivinanza-${i}-`.padEnd(30, "x"), atacante);
      } catch (error) {
        bloqueado = error instanceof ErrorBloqueado;
      }
    }
    expect(bloqueado).toBe(true);
  });

  it("una cuenta pendiente no se activa ni desactiva con el interruptor; se le genera un enlace", async () => {
    await invitar("pendiente@finca.co", ["auditor"]);
    const admin = await e.contexto("admin@demo.local");
    const u = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((x) => x.correo === "pendiente@finca.co")!;
    expect(u).toMatchObject({ pendiente: true, invitacionVigente: true });
    await expect(cambiarEstadoUsuario(e.servicios.usuarios, admin, { usuarioId: u.id, activo: true })).rejects.toThrow(ErrorRegla);
  });

  it("vincula la cuenta de un recolector con su ficha de trabajador, una sola vez", async () => {
    const admin = await e.contexto("admin@demo.local");
    const inv = await invitar("trabajador.nuevo@finca.co");
    const usuarioId = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((x) => x.correo === "trabajador.nuevo@finca.co")!.id;
    const trabajadorId = (await e.pool.query("SELECT id FROM trabajador WHERE numero_documento = '1000000002'")).rows[0].id; // sin cuenta de acceso
    await vincularUsuarioATrabajador(e.servicios.talento, admin, { trabajadorId, usuarioId });
    await expect(vincularUsuarioATrabajador(e.servicios.talento, admin, { trabajadorId, usuarioId })).rejects.toThrow(/ya tiene una cuenta/);
    const sup = await e.contexto("supervisor@demo.local");
    await expect(vincularUsuarioATrabajador(e.servicios.talento, sup, { trabajadorId, usuarioId })).rejects.toThrow(ErrorProhibido);
    await activar(inv.token);
  });
});
