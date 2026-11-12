import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  activarCuenta,
  asignarRolesYFincas,
  cambiarEstadoUsuario,
  emitirEnlace,
  invitarUsuario,
  ErrorNoEncontrado,
  crearFinca,
  crearLote,
  editarFinca,
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
  it("crea la cuenta del propietario sin fincas; al activarla, el propietario registra su finca y sus lotes", async () => {
    const admin = await e.contexto("admin@demo.local");
    const inv = await invitarUsuario(e.servicios.invitaciones, admin, { correo: "maria@elroble.co", nombre: "María Gómez", roles: ["propietario"], fincaIds: [] });
    const usuario = (await listarUsuarios(e.servicios.usuarios, admin)).usuarios.find((u) => u.correo === "maria@elroble.co")!;
    expect(usuario).toMatchObject({ pendiente: true, roles: ["propietario"], fincas: [] });

    await activarCuenta(e.servicios.invitaciones, { token: inv.token, contrasena: CLAVE, confirmacion: CLAVE, aceptaTratamiento: true, ip: "10.7.7.7" });
    const sesion = await iniciarSesion(e.servicios.sesion, { correo: "maria@elroble.co", contrasena: CLAVE, ip: "10.7.7.8" });
    let dueno = await obtenerContexto(e.servicios.sesion, sesion.token, "10.7.7.8");
    expect(dueno.fincaIds).toEqual([]);

    // Ella registra su finca: queda a su nombre, con su bodega, y la ve de inmediato.
    const { id: fincaId } = await crearFinca(e.servicios.fincasLotes, dueno, { nombre: "Finca El Roble", ubicacion: "Vereda Alta", areaHa: "12" });
    expect((await e.pool.query("SELECT count(*)::int AS n FROM bodega WHERE finca_id = $1", [fincaId])).rows[0].n).toBe(1);
    expect((await e.pool.query("SELECT propietario_id FROM finca WHERE id = $1", [fincaId])).rows[0].propietario_id).toBe(usuario.id);
    dueno = await obtenerContexto(e.servicios.sesion, sesion.token, "10.7.7.8");
    expect(dueno.fincaIds).toEqual([fincaId]);

    await crearLote(e.servicios.fincasLotes, dueno, { fincaId, codigo: "L-01", nombre: "Lote Alto", areaHa: "2" });
    const vista = await listarFincasYLotes(e.servicios.fincasLotes, dueno);
    expect(vista.fincas.map((f) => f.nombre)).toEqual(["Finca El Roble"]);
    // El administrador la ve a nombre de ella.
    expect((await listarFincasYLotes(e.servicios.fincasLotes, await e.contexto("admin@demo.local"))).fincas.find((f) => f.id === fincaId)!.propietarioId).toBe(usuario.id);
  });

  it("el administrador no crea fincas ni se las asigna a nadie", async () => {
    const admin = await e.contexto("admin@demo.local");
    await expect(crearFinca(e.servicios.fincasLotes, admin, { nombre: "Finca Del Admin" })).rejects.toThrow(ErrorProhibido);
    await expect(invitarUsuario(e.servicios.invitaciones, admin, { correo: "con.finca@prueba.co", nombre: "Dueño Con Finca", roles: ["propietario"], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorRegla);
    const duenoId = (await e.pool.query("SELECT id FROM usuario WHERE correo = $1", ["propietario@demo.local"])).rows[0].id;
    await expect(asignarRolesYFincas(e.servicios.usuarios, admin, { usuarioId: duenoId, roles: ["propietario"], fincaIds: [e.ids.finca2] })).rejects.toThrow(ErrorRegla);
    expect((await e.contexto("propietario@demo.local")).fincaIds).not.toContain(e.ids.finca2);
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
    // Ni otro administrador ni un propietario necesitan finca: el propietario registra las suyas.
    await invitarUsuario(e.servicios.invitaciones, admin, { correo: "otro.admin@prueba.co", nombre: "Otro Administrador", roles: ["administrador"], fincaIds: [] });
    await invitarUsuario(e.servicios.invitaciones, admin, { correo: "sin.finca@prueba.co", nombre: "Dueño Sin Finca", roles: ["propietario"], fincaIds: [] });
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
    await expect(invitarUsuario(e.servicios.invitaciones, otro, { correo: "sin.fincas@prueba.co", nombre: "Capataz Sin Finca", roles: ["capataz"], fincaIds: [] })).rejects.toThrow(ErrorValidacion);
    await expect(asignarRolesYFincas(e.servicios.usuarios, otro, { usuarioId: r.usuarioId, roles: ["capataz"], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorNoEncontrado);
    const adminId = (await e.pool.query("SELECT id FROM usuario WHERE correo = $1", ["admin@demo.local"])).rows[0].id;
    await expect(asignarRolesYFincas(e.servicios.usuarios, otro, { usuarioId: adminId, roles: ["capataz"], fincaIds: [e.ids.finca1] })).rejects.toThrow(ErrorNoEncontrado);
  });
});

describe("propietarios con varias fincas y su equipo", () => {
  it("el propietario registra otra finca con su propio nombre, crea lotes en ella y solo él la edita", async () => {
    let dueno = await e.contexto("propietario@demo.local");
    const { id: segunda } = await crearFinca(e.servicios.fincasLotes, dueno, { nombre: "Finca La Segunda", areaHa: "4" });
    dueno = await e.contexto("propietario@demo.local");
    expect(dueno.fincaIds).toContain(segunda);
    expect(dueno.fincaIds).toContain(e.ids.finca1); // conserva la que ya tenía
    await crearLote(e.servicios.fincasLotes, dueno, { fincaId: segunda, codigo: "S-01", nombre: "Lote de la segunda", areaHa: "1" });

    // No repite el nombre de una finca suya, pero otro propietario sí puede usar ese nombre.
    await expect(crearFinca(e.servicios.fincasLotes, dueno, { nombre: "finca la segunda" })).rejects.toThrow(ErrorRegla);
    const otro = await e.contexto("propietario.ambas@demo.local");
    await expect(crearFinca(e.servicios.fincasLotes, otro, { nombre: "Finca La Segunda" })).resolves.toHaveProperty("id");

    await editarFinca(e.servicios.fincasLotes, dueno, { fincaId: segunda, nombre: "Finca La Segunda Alta", ubicacion: "Vereda El Palmar", areaHa: "4.5" });
    expect((await e.pool.query("SELECT nombre, ubicacion FROM finca WHERE id = $1", [segunda])).rows[0]).toEqual({ nombre: "Finca La Segunda Alta", ubicacion: "Vereda El Palmar" });
    // El capataz no registra ni edita fincas; otro dueño no edita la ajena.
    const capataz = await e.contexto("capataz@demo.local");
    await expect(crearFinca(e.servicios.fincasLotes, capataz, { nombre: "Finca Del Capataz" })).rejects.toThrow(ErrorProhibido);
    await expect(editarFinca(e.servicios.fincasLotes, otro, { fincaId: segunda, nombre: "Robada" })).rejects.toThrow(ErrorProhibido);
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
