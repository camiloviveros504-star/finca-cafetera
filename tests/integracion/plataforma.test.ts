import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  activarCuenta,
  altaDeFinca,
  asignarRolesYFincas,
  cambiarEstadoUsuario,
  emitirEnlace,
  invitarUsuario,
  ErrorNoEncontrado,
  crearLote,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  iniciarSesion,
  listarFincasYLotes,
  listarUsuarios,
  obtenerContexto,
  registrarCompra,
  registrarRecoleccion,
  registrarVenta,
} from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
const hoy = fechaColombia();
const CLAVE = "Clave-Nueva-2026";

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 6 });
});
afterAll(async () => {
  await e.cerrar();
});

describe("administrador de la plataforma", () => {
  it("da de alta una finca con su propietario en un solo paso; el propietario activa su cuenta y solo ve su finca", async () => {
    const admin = await e.contexto("admin@demo.local");
    const r = await altaDeFinca(e.servicios, admin, { nombre: "Finca El Roble", ubicacion: "Vereda Alta", areaHa: "12", propietarioNombre: "María Gómez", propietarioCorreo: "maria@elroble.co" });
    expect(r.invitacion).not.toBeNull();
    expect((await e.pool.query("SELECT count(*)::int AS n FROM bodega WHERE finca_id = $1", [r.fincaId])).rows[0].n).toBe(1);

    const usuario = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((u) => u.correo === "maria@elroble.co")!;
    expect(usuario).toMatchObject({ pendiente: true, roles: ["propietario"] });
    expect(usuario.fincas.map((f) => f.id)).toEqual([r.fincaId]);

    await activarCuenta(e.servicios.invitaciones, { token: r.invitacion!.token, contrasena: CLAVE, confirmacion: CLAVE, aceptaTratamiento: true, ip: "10.7.7.7" });
    const sesion = await iniciarSesion(e.servicios.sesion, { correo: "maria@elroble.co", contrasena: CLAVE, ip: "10.7.7.8" });
    const dueno = await obtenerContexto(e.servicios.sesion, sesion.token, "10.7.7.8");
    expect(dueno.fincaIds).toEqual([r.fincaId]);

    // Ella maneja su finca: crea lotes. No ve las demás fincas.
    await crearLote(e.servicios.fincasLotes, dueno, { fincaId: r.fincaId, codigo: "L-01", nombre: "Lote Alto", areaHa: "2" });
    const vista = await listarFincasYLotes(e.servicios.fincasLotes, dueno);
    expect(vista.fincas.map((f) => f.nombre)).toEqual(["Finca El Roble"]);
  });

  it("valida antes de crear: correo repetido o incompleto no deja una finca sin dueño", async () => {
    const admin = await e.contexto("admin@demo.local");
    const antes = (await e.pool.query("SELECT count(*)::int AS n FROM finca")).rows[0].n;
    await expect(altaDeFinca(e.servicios, admin, { nombre: "Finca Repetida", propietarioNombre: "Otro", propietarioCorreo: "propietario@demo.local" })).rejects.toThrow(ErrorRegla);
    await expect(altaDeFinca(e.servicios, admin, { nombre: "Finca Sin Correo", propietarioNombre: "Alguien" })).rejects.toThrow(ErrorValidacion);
    await expect(altaDeFinca(e.servicios, admin, { nombre: "Finca Correo Malo", propietarioNombre: "Alguien", propietarioCorreo: "no-es-correo" })).rejects.toThrow(ErrorValidacion);
    expect((await e.pool.query("SELECT count(*)::int AS n FROM finca")).rows[0].n).toBe(antes);
    // Sin propietario también se puede crear: queda para asignarlo después.
    expect((await altaDeFinca(e.servicios, admin, { nombre: "Finca Sin Dueño Aún" })).invitacion).toBeNull();
  });

  it("solo el administrador da de alta fincas", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    await expect(altaDeFinca(e.servicios, dueno, { nombre: "Finca Ajena" })).rejects.toThrow(ErrorProhibido);
  });

  it("consulta todo en solo lectura pero no opera: no vende, no cosecha, no compra, no crea lotes", async () => {
    const admin = await e.contexto("admin@demo.local");
    expect(admin.permisos.has("venta:ver")).toBe(true);
    expect(admin.permisos.has("cosecha:ver")).toBe(true);
    for (const p of ["venta:crear", "venta:anular", "cosecha:registrar", "compra:crear", "pago:registrar", "lote:administrar", "trabajo:validar", "inventario:ajustar", "aplicacion:registrar"]) {
      expect(admin.permisos.has(p), p).toBe(false);
    }
    await expect(registrarVenta(e.servicios.comercial, admin, { fincaId: e.ids.finca1, clienteId: e.ids.clienteA, claveIdempotencia: randomUUID(), items: [{ productoId: e.ids.PSE, cantidad: "1", precioKg: "1000" }] })).rejects.toThrow(ErrorProhibido);
    await expect(registrarRecoleccion(e.servicios, admin, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, productoId: e.ids.CER, fecha: hoy, claveIdempotencia: randomUUID(), kgTotal: "5", lineas: [] })).rejects.toThrow(ErrorProhibido);
    await expect(registrarCompra(e.servicios.finanzas, admin, { fincaId: e.ids.finca1, proveedorId: randomUUID(), fecha: hoy, claveIdempotencia: randomUUID(), lineas: [{ descripcion: "Algo", cantidad: "1", unidad: "unidad", costoUnitario: "100" }] })).rejects.toThrow(ErrorProhibido);
    await expect(crearLote(e.servicios.fincasLotes, admin, { fincaId: e.ids.finca1, codigo: "X-1", nombre: "No" })).rejects.toThrow(ErrorProhibido);
  });
});

describe("modelo de datos: dependencias sin ciclos", () => {
  it("el grafo de llaves foráneas entre tablas es acíclico (la única autorreferencia es el reverso de un movimiento)", async () => {
    const r = await e.pool.query<{ desde: string; hacia: string }>(
      "SELECT conrelid::regclass::text AS desde, confrelid::regclass::text AS hacia FROM pg_constraint WHERE contype = 'f'",
    );
    const aristas = new Map<string, Set<string>>();
    const autorreferencias: string[] = [];
    for (const { desde, hacia } of r.rows) {
      if (desde === hacia) { autorreferencias.push(desde); continue; }
      if (!aristas.has(desde)) aristas.set(desde, new Set());
      aristas.get(desde)!.add(hacia);
    }
    // Búsqueda en profundidad con pila: si se vuelve a un nodo que está en el camino actual, hay un ciclo.
    const estado = new Map<string, 1 | 2>(); // 1 = en el camino, 2 = terminado
    const ciclos: string[] = [];
    const visitar = (n: string, camino: string[]) => {
      estado.set(n, 1);
      for (const m of aristas.get(n) ?? []) {
        if (estado.get(m) === 1) ciclos.push([...camino, n, m].join(" -> "));
        else if (!estado.has(m)) visitar(m, [...camino, n]);
      }
      estado.set(n, 2);
    };
    for (const n of aristas.keys()) if (!estado.has(n)) visitar(n, []);
    expect(ciclos).toEqual([]);
    expect(autorreferencias).toEqual(["movimiento_inventario"]);
  });
});

describe("quién crea qué cuenta", () => {
  it("el administrador crea propietarios y administradores, pero no capataces ni trabajadores; no tiene fincas asignadas", async () => {
    const admin = await e.contexto("admin@demo.local");
    const asignadas = await e.pool.query("SELECT count(*)::int AS n FROM usuario_finca uf JOIN usuario u ON u.id = uf.usuario_id WHERE u.correo = $1", ["admin@demo.local"]);
    expect(asignadas.rows[0].n).toBe(0);
    const total = (await e.pool.query("SELECT count(*)::int AS n FROM finca")).rows[0].n;
    expect(admin.fincaIds).toHaveLength(total); // aun así ve todas las fincas de la plataforma
    for (const rol of ["capataz", "trabajador"]) {
      await expect(invitarUsuario(e.servicios.invitaciones, admin, { correo: `${rol}.admin@prueba.co`, nombre: "No Debe", roles: [rol], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorRegla);
    }
    // Otro administrador no necesita finca; un propietario sí.
    await invitarUsuario(e.servicios.invitaciones, admin, { correo: "otro.admin@prueba.co", nombre: "Otro Administrador", roles: ["administrador"], fincaIds: [] });
    await expect(invitarUsuario(e.servicios.invitaciones, admin, { correo: "sin.finca@prueba.co", nombre: "Dueño Sin Finca", roles: ["propietario"], fincaIds: [] })).rejects.toThrow(ErrorValidacion);
    const roles = (await listarUsuarios(e.servicios.usuarios, admin)).roles.map((r) => r.codigo);
    expect(roles).not.toContain("capataz");
    expect(roles).not.toContain("trabajador");
  });

  it("el propietario crea capataces para una o varias de sus fincas y reorganiza su equipo, solo dentro de sus fincas", async () => {
    const dueno = await e.contexto("propietario.ambas@demo.local"); // tiene las fincas 1 y 2
    const r = await invitarUsuario(e.servicios.invitaciones, dueno, { correo: "capataz.dos@prueba.co", nombre: "Capataz Dos Fincas", roles: ["capataz"], fincaIds: [e.ids.finca1, e.ids.finca2] });
    const visto = (await listarUsuarios(e.servicios.usuarios, dueno)).usuarios.find((u) => u.id === r.usuarioId)!;
    expect(visto.fincas.map((f) => f.id).sort()).toEqual([e.ids.finca1, e.ids.finca2].sort());
    // Le deja solo la finca 2.
    await asignarRolesYFincas(e.servicios.usuarios, dueno, { usuarioId: r.usuarioId, roles: ["capataz"], fincaIds: [e.ids.finca2] });
    expect((await listarUsuarios(e.servicios.usuarios, dueno)).usuarios.find((u) => u.id === r.usuarioId)!.fincas.map((f) => f.id)).toEqual([e.ids.finca2]);

    // En su lista de cuentas solo aparece su equipo: ni él mismo, ni otros dueños, ni cuentas de la plataforma.
    const lista = (await listarUsuarios(e.servicios.usuarios, dueno)).usuarios;
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((u) => u.roles.every((rol) => rol === "capataz" || rol === "trabajador"))).toBe(true);

    // El dueño de una sola finca no asigna la ajena, no crea propietarios ni toca cuentas que no son de su equipo.
    const otro = await e.contexto("propietario@demo.local");
    await expect(invitarUsuario(e.servicios.invitaciones, otro, { correo: "ajeno@prueba.co", nombre: "Capataz Ajeno", roles: ["capataz"], fincaIds: [e.ids.finca2] })).rejects.toThrow(ErrorProhibido);
    await expect(invitarUsuario(e.servicios.invitaciones, otro, { correo: "dueno2@prueba.co", nombre: "Otro Dueño", roles: ["propietario"], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorProhibido);
    await expect(invitarUsuario(e.servicios.invitaciones, otro, { correo: "sin.fincas@prueba.co", nombre: "Capataz Sin Finca", roles: ["capataz"], fincaIds: [] })).rejects.toThrow(ErrorProhibido);
    await expect(asignarRolesYFincas(e.servicios.usuarios, otro, { usuarioId: r.usuarioId, roles: ["capataz"], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorNoEncontrado);
    const adminId = (await e.pool.query("SELECT id FROM usuario WHERE correo = $1", ["admin@demo.local"])).rows[0].id;
    await expect(asignarRolesYFincas(e.servicios.usuarios, otro, { usuarioId: adminId, roles: ["capataz"], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorNoEncontrado);
  });
});

describe("propietarios con varias fincas y su equipo", () => {
  it("el administrador le da una segunda finca a un propietario existente; el dueño la ve y crea lotes en ella", async () => {
    const admin = await e.contexto("admin@demo.local");
    const dueno = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((u) => u.correo === "propietario@demo.local")!;
    const r = await altaDeFinca(e.servicios, admin, { nombre: "Finca La Segunda", areaHa: "4", propietarioId: dueno.id });
    expect(r).toMatchObject({ invitacion: null, propietario: dueno.nombre });
    const ctx = await e.contexto("propietario@demo.local");
    expect(ctx.fincaIds).toContain(r.fincaId);
    expect(ctx.fincaIds).toContain(e.ids.finca1); // conserva la que ya tenía
    await crearLote(e.servicios.fincasLotes, ctx, { fincaId: r.fincaId, codigo: "S-01", nombre: "Lote de la segunda", areaHa: "1" });
    // Un correo ya usado por un capataz no deja crear la finca con un "dueño nuevo".
    const antes = (await e.pool.query("SELECT count(*)::int AS n FROM finca")).rows[0].n;
    await expect(altaDeFinca(e.servicios, admin, { nombre: "Finca Repetida", propietarioNombre: "Alguien", propietarioCorreo: "capataz@demo.local" })).rejects.toThrow(ErrorRegla);
    await expect(altaDeFinca(e.servicios, admin, { nombre: "Finca De Nadie", propietarioId: (await e.pool.query("SELECT id FROM usuario WHERE correo = $1", ["capataz@demo.local"])).rows[0].id })).rejects.toThrow(ErrorRegla);
    expect((await e.pool.query("SELECT count(*)::int AS n FROM finca")).rows[0].n).toBe(antes);
  });

  it("el administrador ve de cada propietario cuántos capataces y trabajadores tiene, pero no gestiona esas cuentas", async () => {
    const admin = await e.contexto("admin@demo.local");
    const lista = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios;
    expect(lista.some((u) => u.roles.includes("capataz") || u.roles.includes("trabajador"))).toBe(false);
    const ambas = lista.find((u) => u.correo === "propietario.ambas@demo.local")!;
    expect(ambas.equipo!.capataces).toBeGreaterThanOrEqual(1);
    expect(ambas.equipo!.trabajadores).toBeGreaterThanOrEqual(1);

    const capatazId = (await e.pool.query("SELECT id FROM usuario WHERE correo = $1", ["capataz@demo.local"])).rows[0].id;
    await expect(emitirEnlace(e.servicios.invitaciones, admin, { usuarioId: capatazId })).rejects.toThrow(ErrorRegla);
    await expect(cambiarEstadoUsuario(e.servicios.usuarios, admin, { usuarioId: capatazId, activo: false })).rejects.toThrow(ErrorRegla);
    // A un propietario sí le puede generar el enlace para cambiar la contraseña.
    const duenoId = (await e.pool.query("SELECT id FROM usuario WHERE correo = $1", ["propietario@demo.local"])).rows[0].id;
    await expect(emitirEnlace(e.servicios.invitaciones, admin, { usuarioId: duenoId })).resolves.toMatchObject({ tipo: "restablecimiento" });
  });

  it("el propietario cambia la contraseña y desactiva o reactiva a su capataz y a sus trabajadores", async () => {
    const dueno = await e.contexto("propietario@demo.local");
    const ids = async (correo: string) => (await e.pool.query("SELECT id FROM usuario WHERE correo = $1", [correo])).rows[0].id as string;
    await expect(emitirEnlace(e.servicios.invitaciones, dueno, { usuarioId: await ids("capataz@demo.local") })).resolves.toMatchObject({ tipo: "restablecimiento" });
    await cambiarEstadoUsuario(e.servicios.usuarios, dueno, { usuarioId: await ids("trabajador@demo.local"), activo: false });
    expect((await e.pool.query("SELECT activo FROM usuario WHERE correo = $1", ["trabajador@demo.local"])).rows[0].activo).toBe(false);
    await cambiarEstadoUsuario(e.servicios.usuarios, dueno, { usuarioId: await ids("trabajador@demo.local"), activo: true });
    // No toca a otros propietarios ni al administrador.
    await expect(cambiarEstadoUsuario(e.servicios.usuarios, dueno, { usuarioId: await ids("propietario.ambas@demo.local"), activo: false })).rejects.toThrow(ErrorNoEncontrado);
    await expect(emitirEnlace(e.servicios.invitaciones, dueno, { usuarioId: await ids("admin@demo.local") })).rejects.toThrow(ErrorNoEncontrado);
  });
});
