/**
 * Datos de DEMOSTRACIÓN. Todo lo que se crea aquí está marcado DEMO (nombres y es_demo = true).
 * Los precios y equivalencias NO son valores comerciales reales.
 */
import type { Client } from "pg";
import { cifrarContrasena } from "../src/shared/contrasenas";

export const CONTRASENA_DEMO = "Demo-2026!";

async function uno<T = { id: string }>(c: Client, sql: string, params: unknown[] = []): Promise<T> {
  const r = await c.query(sql, params);
  return r.rows[0] as T;
}

export async function sembrar(c: Client): Promise<void> {
  const clave = await cifrarContrasena(CONTRASENA_DEMO);
  await c.query("BEGIN");
  try {
    const org = await uno(c, "INSERT INTO organizacion (nombre, es_demo) VALUES ('Organización DEMO', true) RETURNING id");
    const f1 = await uno(c, "INSERT INTO finca (organizacion_id, nombre, ubicacion, area_ha) VALUES ($1,'Finca El Mirador DEMO','Vereda ilustrativa',12.5) RETURNING id", [org.id]);
    const f2 = await uno(c, "INSERT INTO finca (organizacion_id, nombre, ubicacion, area_ha) VALUES ($1,'Finca La Esperanza DEMO','Vereda ilustrativa',8) RETURNING id", [org.id]);

    const roles = Object.fromEntries(
      (await c.query<{ id: string; codigo: string }>("SELECT id, codigo FROM rol")).rows.map((r) => [r.codigo, r.id]),
    );
    const usuarios: Array<[string, string, string, string[]]> = [
      ["admin@demo.local", "Administrador DEMO", "administrador", [f1.id, f2.id]],
      ["produccion@demo.local", "Encargado de producción DEMO", "encargado_produccion", [f1.id]],
      ["comercial@demo.local", "Responsable comercial DEMO", "responsable_comercial", [f1.id]],
      ["comercial2@demo.local", "Responsable comercial finca 2 DEMO", "responsable_comercial", [f2.id]],
    ];
    const idUsuario: Record<string, string> = {};
    for (const [correo, nombre, rol, fincas] of usuarios) {
      const u = await uno(
        c,
        "INSERT INTO usuario (organizacion_id, correo, nombre, password_hash, autorizo_tratamiento_en) VALUES ($1,$2,$3,$4, now()) RETURNING id",
        [org.id, correo, nombre, clave],
      );
      idUsuario[correo] = u.id;
      await c.query("INSERT INTO usuario_rol (usuario_id, rol_id) VALUES ($1,$2)", [u.id, roles[rol]]);
      for (const f of fincas) await c.query("INSERT INTO usuario_finca (usuario_id, finca_id) VALUES ($1,$2)", [u.id, f]);
    }

    const unidades = Object.fromEntries(
      (await c.query<{ id: string; codigo: string }>("SELECT id, codigo FROM unidad")).rows.map((r) => [r.codigo, r.id]),
    );
    // Equivalencias de DEMOSTRACIÓN (fuente "Parcial"; ver docs/investigacion). Son parámetros, no constantes.
    for (const [origen, factor] of [["arroba", 12.5], ["carga", 125], ["saco", 70]] as const) {
      await c.query(
        "INSERT INTO conversion_unidad (organizacion_id, unidad_origen_id, unidad_destino_id, factor, vigencia, es_demo, creada_por) VALUES ($1,$2,$3,$4,'[2020-01-01,)', true, $5)",
        [org.id, unidades[origen], unidades.kg, factor, idUsuario["admin@demo.local"]],
      );
    }
    for (const [catalogo, codigo, nombre] of [
      ["metodo_pago", "efectivo", "Efectivo"],
      ["metodo_pago", "transferencia", "Transferencia"],
      ["tipo_cafe", "caturra", "Caturra"],
      ["tipo_cafe", "castillo", "Castillo"],
      ["categoria_producto", "cafe", "Café"],
    ]) {
      await c.query("INSERT INTO catalogo_valor (organizacion_id, catalogo, codigo, nombre) VALUES ($1,$2,$3,$4)", [org.id, catalogo, codigo, nombre]);
    }

    const prod: Record<string, string> = {};
    for (const [codigo, nombre, vendible] of [
      ["CER", "Café cereza DEMO", false],
      ["PSE", "Pergamino seco DEMO", true],
      ["EXC", "Excelso DEMO", true],
    ] as const) {
      prod[codigo] = (
        await uno(c, "INSERT INTO producto (organizacion_id, codigo, nombre, categoria, unidad_id, vendible, es_demo) VALUES ($1,$2,$3,'cafe',$4,$5,true) RETURNING id", [org.id, codigo, nombre, unidades.kg, vendible])
      ).id;
    }

    // Precios de DEMOSTRACIÓN (no son valores comerciales).
    const precios: Array<[string, number]> = [["PSE", 14000], ["EXC", 19000]];
    for (const [codigo, valor] of precios) {
      const t = await uno(c, "INSERT INTO tarifa (organizacion_id, codigo, tipo, producto_id, unidad_id) VALUES ($1,'precio_venta','precio_venta',$2,$3) RETURNING id", [org.id, prod[codigo], unidades.kg]);
      await c.query("INSERT INTO tarifa_version (tarifa_id, version, valor, vigencia, es_demo, creada_por) VALUES ($1,1,$2,'[2026-01-01,)', true, $3)", [t.id, valor, idUsuario["admin@demo.local"]]);
    }

    const b1 = await uno(c, "INSERT INTO bodega (organizacion_id, finca_id, nombre) VALUES ($1,$2,'Bodega principal DEMO') RETURNING id", [org.id, f1.id]);
    const b2 = await uno(c, "INSERT INTO bodega (organizacion_id, finca_id, nombre) VALUES ($1,$2,'Bodega DEMO finca 2') RETURNING id", [org.id, f2.id]);
    const lotes: Record<string, string> = {};
    for (const [fid, codigo, nombre, ha, variedad] of [
      [f1.id, "L-01", "Lote La Cima DEMO", 3.5, "Castillo"],
      [f1.id, "L-02", "Lote El Río DEMO", 2.8, "Caturra"],
      [f1.id, "L-03", "Lote La Loma DEMO", 4.1, "Castillo"],
      [f2.id, "L-01", "Lote Norte DEMO", 3, "Caturra"],
    ] as const) {
      lotes[`${fid}:${codigo}`] = (
        await uno(c, "INSERT INTO lote (organizacion_id, finca_id, codigo, nombre, area_ha, variedad) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [org.id, fid, codigo, nombre, ha, variedad])
      ).id;
    }

    // Existencias iniciales (movimiento + saldo en la misma transacción).
    const existencias: Array<[string, string, string, string, number]> = [
      [f1.id, b1.id, "PSE", "L-01", 60],
      [f1.id, b1.id, "PSE", "L-02", 40],
      [f1.id, b1.id, "EXC", "L-01", 25],
      [f2.id, b2.id, "PSE", "L-01", 30],
    ];
    for (const [fid, bid, codigo, lote, cantidad] of existencias) {
      const loteId = lotes[`${fid}:${lote}`];
      await c.query(
        "INSERT INTO movimiento_inventario (organizacion_id, finca_id, bodega_id, producto_id, lote_id, tipo, delta, origen_tipo, creado_por, nota) VALUES ($1,$2,$3,$4,$5,'existencia_inicial',$6,'manual',$7,'Existencia inicial DEMO')",
        [org.id, fid, bid, prod[codigo], loteId, cantidad, idUsuario["admin@demo.local"]],
      );
      await c.query(
        "INSERT INTO saldo_inventario (organizacion_id, finca_id, bodega_id, producto_id, lote_id, cantidad) VALUES ($1,$2,$3,$4,$5,$6)",
        [org.id, fid, bid, prod[codigo], loteId, cantidad],
      );
    }

    for (const [nombre, doc] of [["Cliente DEMO Tostadora Andina", "900000001"], ["Cliente DEMO Exportadora del Valle", "900000002"]]) {
      await c.query("INSERT INTO cliente (organizacion_id, nombre, documento, autorizo_tratamiento_en) VALUES ($1,$2,$3, now())", [org.id, nombre, doc]);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  }
}
