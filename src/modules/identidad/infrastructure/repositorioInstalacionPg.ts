import type { Transaccion } from "@/shared/dominio/contexto";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { DatosInstalacion, RepositorioInstalacion } from "../domain/instalacion";

const CATALOGOS: [string, string, string][] = [
  ["metodo_pago", "efectivo", "Efectivo"],
  ["metodo_pago", "transferencia", "Transferencia"],
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
  ["categoria_producto", "cafe", "Café"],
];

/** Productos básicos del café; el flujo de beneficio los encadena (cereza → pergamino húmedo → pergamino seco → excelso). */
const PRODUCTOS: [string, string, boolean][] = [
  ["CER", "Café rojo sin despulpar (cereza)", true],
  ["PHU", "Café húmedo o mojado", true],
  ["PSE", "Café seco (pergamino)", true],
  ["PAS", "Pasilla", true],
  ["PLU", "Plumilla", true],
  ["EXC", "Café en almendra", true],
  ["TOS", "Café tostado", true],
];

/** Recomendaciones de manejo por edad (fuente: Cenicafé). Sin dosis de producción: la fija el análisis de suelo. */
const FUENTE_LEVANTE = "Cenicafé: 58 g de nitrógeno por planta en 18 meses (7, 9, 12, 14 y 16 g)";
const RECOMENDACIONES: [string, number, number | null, string, string, string, number | null, string][] = [
  ["levante", 2, 2, "abonada", "Primera abonada (mes 2)", "Fertilizante con nitrógeno alrededor del árbol, al comenzar un período de lluvias.", 7, FUENTE_LEVANTE],
  ["levante", 6, 6, "abonada", "Segunda abonada (mes 6)", "Fertilizante con nitrógeno, al comenzar un período de lluvias.", 9, FUENTE_LEVANTE],
  ["levante", 10, 10, "abonada", "Tercera abonada (mes 10)", "Fertilizante con nitrógeno, al comenzar un período de lluvias.", 12, FUENTE_LEVANTE],
  ["levante", 14, 14, "abonada", "Cuarta abonada (mes 14)", "Fertilizante con nitrógeno, al comenzar un período de lluvias.", 14, FUENTE_LEVANTE],
  ["levante", 18, 18, "abonada", "Quinta abonada (mes 18)", "Fertilizante con nitrógeno, al comenzar un período de lluvias.", 16, FUENTE_LEVANTE],
  ["produccion", 24, 59, "abonada", "Abonada anual en producción", "Fertilice al comenzar cada período de lluvias. El nitrógeno es el nutriente más limitante; la dosis la define su análisis de suelo y la producción esperada. Registre aquí la dosis que adopte.", null, "Cenicafé: fertilizar al comenzar los períodos lluviosos; dosis según análisis de suelo"],
  ["renovacion", 60, null, "renovacion", "Evaluar la renovación (año 5 o 6)", "Hacia el quinto o sexto año, con 4 o 5 cosechas, el cafetal llega a la edad de renovación. Opciones: zoca (corte a unos 30 cm; más económica y rinde otras 4 o 5 cosechas) o tumbar y resembrar (permite ajustar la densidad). La zoca se hace en período seco y con cosecha sanitaria previa.", null, "Cenicafé, Avances Técnicos sobre renovación de cafetales"],
];

/** Flujos iniciales sin porcentajes de merma: el administrador los define según su proceso. */
const FLUJOS: [string, string, [string, string, string, string][]][] = [
  ["cafe_lavado", "Café lavado", [["despulpado", "Despulpado", "CER", "PHU"], ["secado", "Secado", "PHU", "PSE"], ["trilla", "Trilla", "PSE", "EXC"]]],
  ["cafe_natural", "Café natural", [["secado_natural", "Secado en cereza", "CER", "PSE"], ["trilla", "Trilla", "PSE", "EXC"]]],
];

export class RepositorioInstalacionPg implements RepositorioInstalacion {
  async hayOrganizacion(tx: Transaccion): Promise<boolean> {
    return (await clienteDe(tx).query("SELECT 1 FROM organizacion LIMIT 1")).rowCount === 1;
  }

  async instalar(tx: Transaccion, d: DatosInstalacion) {
    const c = clienteDe(tx);
    // Un solo instalador a la vez: si dos solicitudes llegan juntas, la segunda espera y ve que ya existe una organización.
    await c.query("SELECT pg_advisory_xact_lock(7311001)");
    if (await this.hayOrganizacion(tx)) return null;

    const org = (await c.query("INSERT INTO organizacion (nombre, es_demo) VALUES ($1, false) RETURNING id", [d.organizacion])).rows[0].id as string;
    const finca = (await c.query("INSERT INTO finca (organizacion_id, nombre) VALUES ($1,$2) RETURNING id", [org, d.finca])).rows[0].id as string;
    await c.query("INSERT INTO bodega (organizacion_id, finca_id, nombre) VALUES ($1,$2,'Bodega principal')", [org, finca]);

    const usuario = (
      await c.query("INSERT INTO usuario (organizacion_id, correo, nombre, password_hash, autorizo_tratamiento_en) VALUES ($1,$2,$3,$4, now()) RETURNING id", [org, d.administrador.correo, d.administrador.nombre, d.administrador.hash])
    ).rows[0].id as string;
    await c.query("INSERT INTO usuario_rol (usuario_id, rol_id) SELECT $1, id FROM rol WHERE codigo = 'administrador'", [usuario]);
    await c.query("INSERT INTO usuario_finca (usuario_id, finca_id) VALUES ($1,$2)", [usuario, finca]);

    for (const [catalogo, codigo, nombre] of CATALOGOS) {
      await c.query("INSERT INTO catalogo_valor (organizacion_id, catalogo, codigo, nombre) VALUES ($1,$2,$3,$4)", [org, catalogo, codigo, nombre]);
    }
    const kg = (await c.query("SELECT id FROM unidad WHERE codigo = 'kg'")).rows[0].id as string;
    const productos: Record<string, string> = {};
    for (const [codigo, nombre, vendible] of PRODUCTOS) {
      productos[codigo] = (
        await c.query("INSERT INTO producto (organizacion_id, codigo, nombre, categoria, unidad_id, vendible, es_demo) VALUES ($1,$2,$3,'cafe',$4,$5,false) RETURNING id", [org, codigo, nombre, kg, vendible])
      ).rows[0].id as string;
    }
    for (const [etapa, desde, hasta, labor, titulo, detalle, gramos, fuente] of RECOMENDACIONES) {
      await c.query("INSERT INTO recomendacion_cultivo (organizacion_id, etapa, edad_desde_meses, edad_hasta_meses, labor, titulo, detalle, gramos_por_planta, fuente) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [org, etapa, desde, hasta, labor, titulo, detalle, gramos, fuente]);
    }
    for (const [codigo, nombre, etapas] of FLUJOS) {
      const tipo = (await c.query("INSERT INTO proceso_tipo (organizacion_id, codigo, nombre, creado_por) VALUES ($1,$2,$3,$4) RETURNING id", [org, codigo, nombre, usuario])).rows[0].id as string;
      let orden = 1;
      for (const [ec, en, entrada, salida] of etapas) {
        await c.query("INSERT INTO proceso_etapa (proceso_tipo_id, orden, codigo, nombre, producto_entrada_id, producto_salida_id) VALUES ($1,$2,$3,$4,$5,$6)", [tipo, orden++, ec, en, productos[entrada], productos[salida]]);
      }
    }
    return { organizacionId: org, usuarioId: usuario };
  }
}
