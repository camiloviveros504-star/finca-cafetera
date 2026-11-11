/**
 * Datos de DEMOSTRACIÓN. Todo lo que se crea aquí está marcado DEMO (nombres y es_demo = true).
 * Los precios y equivalencias NO son valores comerciales reales.
 */
import type { Client } from "pg";
import { RECOMENDACIONES } from "../src/modules/identidad/infrastructure/repositorioInstalacionPg";
import { cifrarContrasena } from "../src/shared/infraestructura/contrasenas";

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
    for (const [etapa, desde, hasta, labor, titulo, detalle, gramos, fuente] of RECOMENDACIONES) {
      await c.query("INSERT INTO recomendacion_cultivo (organizacion_id, etapa, edad_desde_meses, edad_hasta_meses, labor, titulo, detalle, gramos_por_planta, fuente) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [org.id, etapa, desde, hasta, labor, titulo, detalle, gramos, fuente]);
    }
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
      ["supervisor@demo.local", "Supervisor de campo DEMO", "supervisor_campo", [f1.id]],
      ["recolector@demo.local", "Recolector DEMO", "recolector", [f1.id]],
      ["financiero@demo.local", "Responsable financiero DEMO", "responsable_financiero", [f1.id, f2.id]],
      ["bodega@demo.local", "Responsable de bodega DEMO", "responsable_bodega", [f1.id]],
      ["auditor@demo.local", "Auditor DEMO", "auditor", [f1.id, f2.id]],
      ["propietario@demo.local", "Propietario DEMO", "propietario", [f1.id]],
      ["propietario.ambas@demo.local", "Propietario de ambas fincas DEMO", "propietario", [f1.id, f2.id]],
      ["capataz@demo.local", "Capataz DEMO", "capataz", [f1.id]],
      ["trabajador@demo.local", "Trabajador DEMO", "trabajador", [f1.id]],
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
      ["tipo_gasto", "insumos", "Insumos agrícolas"],
      ["tipo_gasto", "mano_obra", "Mano de obra"],
      ["tipo_gasto", "administrativo", "Gasto administrativo"],
      ["tipo_gasto", "mantenimiento", "Mantenimiento de maquinaria"],
      ["tipo_gasto", "combustible", "Combustible"],
      ["tipo_gasto", "flete", "Flete (transporte de café)"],
      ["tipo_gasto", "jornales", "Jornales y mano de obra"],
      ["tipo_gasto", "fertilizacion", "Fertilización"],
      ["tipo_gasto", "fumigacion", "Fumigación"],
      ["tipo_gasto", "servicios", "Servicios y otros pagos"],
    ]) {
      await c.query("INSERT INTO catalogo_valor (organizacion_id, catalogo, codigo, nombre) VALUES ($1,$2,$3,$4)", [org.id, catalogo, codigo, nombre]);
    }

    const prod: Record<string, string> = {};
    for (const [codigo, nombre, vendible] of [
      ["CER", "Café cereza DEMO", true],
      ["PHU", "Pergamino húmedo DEMO", true],
      ["PSE", "Pergamino seco DEMO", true],
      ["EXC", "Excelso DEMO", true],
      ["PAS", "Pasilla DEMO", true],
      ["PLU", "Plumilla DEMO", true],
      ["TOS", "Café tostado DEMO", true],
    ] as const) {
      prod[codigo] = (
        await uno(c, "INSERT INTO producto (organizacion_id, codigo, nombre, categoria, unidad_id, vendible, es_demo) VALUES ($1,$2,$3,'cafe',$4,$5,true) RETURNING id", [org.id, codigo, nombre, unidades.kg, vendible])
      ).id;
    }

    // Flujos de beneficio de DEMOSTRACIÓN: etapas, orden y mermas esperadas son datos configurables (no valores técnicos reales).
    const flujos: Array<[string, string, Array<[string, string, string, string, number]>]> = [
      ["cafe_lavado_demo", "Café lavado DEMO", [["despulpado", "Despulpado", "CER", "PHU", 5], ["secado", "Secado", "PHU", "PSE", 50], ["trilla", "Trilla", "PSE", "EXC", 20]]],
      ["cafe_natural_demo", "Café natural DEMO", [["secado_natural", "Secado en cereza", "CER", "PSE", 60], ["trilla", "Trilla", "PSE", "EXC", 20]]],
    ];
    for (const [codigo, nombre, etapas] of flujos) {
      const pt = await uno(c, "INSERT INTO proceso_tipo (organizacion_id, codigo, nombre, es_demo, creado_por) VALUES ($1,$2,$3,true,$4) RETURNING id", [org.id, codigo, nombre, idUsuario["admin@demo.local"]]);
      let orden = 1;
      for (const [ec, en, pin, pout, merma] of etapas) {
        await c.query("INSERT INTO proceso_etapa (proceso_tipo_id, orden, codigo, nombre, producto_entrada_id, producto_salida_id, merma_esperada_pct) VALUES ($1,$2,$3,$4,$5,$6,$7)", [pt.id, orden++, ec, en, prod[pin], prod[pout], merma]);
      }
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

    // Trabajadores y tarifas de pago de DEMOSTRACIÓN (no son valores comerciales ni legales).
    for (const [codigo, tipo, unidad, valor] of [["pago_kg", "pago_kg", "kg", 1500], ["pago_jornada", "pago_jornada", "jornada", 60000]] as const) {
      const t = await uno(c, "INSERT INTO tarifa (organizacion_id, codigo, tipo, unidad_id) VALUES ($1,$2,$3,$4) RETURNING id", [org.id, codigo, tipo, unidades[unidad]]);
      await c.query("INSERT INTO tarifa_version (tarifa_id, version, valor, vigencia, es_demo, creada_por) VALUES ($1,1,$2,'[2026-01-01,)', true, $3)", [t.id, valor, idUsuario["admin@demo.local"]]);
    }
    for (const [doc, nombres, apellidos, modalidad, correo] of [
      ["1000000001", "Recolector", "DEMO Uno", "kg", "recolector@demo.local"],
      ["1000000002", "Recolectora", "DEMO Dos", "arroba", null],
      ["1000000003", "Obrero", "DEMO Tres", "jornada", null],
      ["1000000004", "Peón", "DEMO Cuatro", "kg", "trabajador@demo.local"],
    ] as const) {
      const w = await uno(c, "INSERT INTO trabajador (organizacion_id, usuario_id, numero_documento, nombres, apellidos, autorizo_tratamiento_en, finalidad_tratamiento) VALUES ($1,$2,$3,$4,$5, now(), 'Registro de producción y pago (DEMO)') RETURNING id", [org.id, correo ? idUsuario[correo] : null, doc, nombres, apellidos]);
      await c.query("INSERT INTO vinculacion (organizacion_id, trabajador_id, finca_id, modalidad, vigencia) VALUES ($1,$2,$3,$4,'[2026-01-01,)')", [org.id, w.id, f1.id, modalidad]);
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
