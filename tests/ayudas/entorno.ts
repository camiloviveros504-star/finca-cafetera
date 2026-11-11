import { randomBytes } from "node:crypto";
import { Client, Pool } from "pg";
import { migrar } from "../../db/migrador";
import { sembrar, CONTRASENA_DEMO } from "../../db/semilla";
import { crearServicios, iniciarSesion, obtenerContexto, type ContextoUsuario, type Servicios } from "@/composicion";

/** Servidor PostgreSQL real para pruebas (local con db:local o el servicio de CI). */
const URL_ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? "postgresql://finca:finca_local@localhost:5433/postgres";

export interface Entorno {
  pool: Pool;
  servicios: Servicios;
  url: string;
  ids: Record<string, string>;
  contexto(correo: string): Promise<ContextoUsuario>;
  cerrar(): Promise<void>;
}

export async function crearEntorno(opciones: { poolMax?: number } = {}): Promise<Entorno> {
  const nombre = `prueba_${randomBytes(6).toString("hex")}`;
  const admin = new Client({ connectionString: URL_ADMIN });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nombre}`);
  await admin.end();

  const url = URL_ADMIN.replace(/\/[^/]*$/, `/${nombre}`);
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  await migrar(cliente);
  await sembrar(cliente);
  await cliente.end();

  const pool = new Pool({ connectionString: url, max: opciones.poolMax ?? 30 });
  const servicios = crearServicios(pool);

  const consulta = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows;
  const fincas = await consulta("SELECT id, nombre FROM finca ORDER BY nombre");
  const productos = await consulta("SELECT id, codigo FROM producto");
  const lotes = await consulta("SELECT l.id, l.codigo, f.nombre AS finca FROM lote l JOIN finca f ON f.id = l.finca_id");
  const bodegas = await consulta("SELECT id, finca_id FROM bodega");
  const clientes = await consulta("SELECT id, nombre FROM cliente ORDER BY nombre");
  const unidades = await consulta("SELECT id, codigo FROM unidad");
  const ids: Record<string, string> = {
    finca1: fincas.find((f) => f.nombre.includes("Mirador")).id,
    finca2: fincas.find((f) => f.nombre.includes("Esperanza")).id,
    clienteA: clientes[0].id,
    PSE: productos.find((p) => p.codigo === "PSE").id,
    EXC: productos.find((p) => p.codigo === "EXC").id,
    CER: productos.find((p) => p.codigo === "CER").id,
    lote1_01: lotes.find((l) => l.codigo === "L-01" && l.finca.includes("Mirador")).id,
    lote1_02: lotes.find((l) => l.codigo === "L-02").id,
    lote2_01: lotes.find((l) => l.codigo === "L-01" && l.finca.includes("Esperanza")).id,
    bodega1: bodegas.find((b) => b.finca_id === fincas.find((f) => f.nombre.includes("Mirador")).id).id,
    bodega2: bodegas.find((b) => b.finca_id === fincas.find((f) => f.nombre.includes("Esperanza")).id).id,
    kg: unidades.find((u) => u.codigo === "kg").id,
    arroba: unidades.find((u) => u.codigo === "arroba").id,
  };

  let n = 0;
  return {
    pool,
    servicios,
    url,
    ids,
    async contexto(correo: string) {
      const ip = `10.0.0.${(n += 1)}`;
      const sesion = await iniciarSesion(servicios.sesion, { correo, contrasena: CONTRASENA_DEMO, ip });
      return obtenerContexto(servicios.sesion, sesion.token, ip);
    },
    async cerrar() {
      await pool.end();
      const a = new Client({ connectionString: URL_ADMIN });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
      await a.end();
    },
  };
}
