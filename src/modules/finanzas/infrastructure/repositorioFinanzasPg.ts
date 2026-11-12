import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorRegla } from "@/shared/dominio/errores";
import { restar, sumar } from "@/shared/dominio/dinero";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { CompraParaMovimiento, Conciliacion, FilaCompra, FilaGasto, FilaProveedor, LineaCompra, RepositorioFinanzas, ResumenFinanciero } from "../domain/puertos";

const BOGOTA = "AT TIME ZONE 'America/Bogota'";

export class RepositorioFinanzasPg implements RepositorioFinanzas {
  async crearProveedor(tx: Transaccion, p: Parameters<RepositorioFinanzas["crearProveedor"]>[1]): Promise<string> {
    try {
      const r = await clienteDe(tx).query(
        "INSERT INTO proveedor (organizacion_id, nombre, documento, telefono, correo, autorizo_tratamiento_en, finca_id) VALUES ($1,$2,$3,$4,$5, CASE WHEN $6::boolean THEN now() END, $7) RETURNING id",
        [p.organizacionId, p.nombre, p.documento ?? null, p.telefono ?? null, p.correo ?? null, p.autorizaTratamiento, p.fincaId ?? null],
      );
      return r.rows[0].id as string;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ErrorRegla("Ya existe un proveedor con ese documento", "proveedor_duplicado");
      throw error;
    }
  }

  async listarProveedores(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaProveedor[]> {
    const r = await clienteDe(tx).query(
      `SELECT p.id, p.nombre, p.documento, p.telefono, p.correo,
              coalesce((SELECT sum(c.total - c.pagado) FROM compra c WHERE c.proveedor_id = p.id AND c.estado = 'recibida'), 0) AS por_pagar
         FROM proveedor p WHERE p.organizacion_id = $1 AND p.activo AND (p.finca_id IS NULL OR p.finca_id = ANY($2::uuid[])) ORDER BY p.nombre`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, nombre: x.nombre, documento: x.documento, telefono: x.telefono, correo: x.correo, porPagar: x.por_pagar }));
  }

  async proveedorExiste(tx: Transaccion, organizacionId: string, proveedorId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM proveedor WHERE id = $1 AND organizacion_id = $2 AND activo", [proveedorId, organizacionId]);
    return r.rowCount === 1;
  }

  async buscarCompraPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM compra WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async insertarCompra(tx: Transaccion, c: Parameters<RepositorioFinanzas["insertarCompra"]>[1]): Promise<string> {
    const cl = clienteDe(tx);
    const r = await cl.query(
      "INSERT INTO compra (organizacion_id, finca_id, proveedor_id, fecha, total, clave_idempotencia, creado_por, nota) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [c.organizacionId, c.fincaId, c.proveedorId, c.fecha, c.total, c.clave, c.creadoPor, c.nota ?? null],
    );
    const id = r.rows[0].id as string;
    for (const l of c.lineas) {
      await cl.query("INSERT INTO compra_detalle (compra_id, descripcion, cantidad, unidad, costo_unitario, subtotal, insumo_id) VALUES ($1,$2,$3,$4,$5,$6,$7)", [id, l.descripcion, l.cantidad, l.unidad, l.costoUnitario, l.subtotal, l.insumoId ?? null]);
    }
    return id;
  }

  async lineasDeInsumo(tx: Transaccion, compraId: string) {
    const r = await clienteDe(tx).query("SELECT insumo_id, cantidad FROM compra_detalle WHERE compra_id = $1 AND insumo_id IS NOT NULL", [compraId]);
    return r.rows.map((x) => ({ insumoId: x.insumo_id as string, cantidad: x.cantidad as string }));
  }

  async bloquearCompra(tx: Transaccion, organizacionId: string, compraId: string): Promise<CompraParaMovimiento | null> {
    const r = await clienteDe(tx).query("SELECT id, finca_id, estado, total, pagado FROM compra WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [compraId, organizacionId]);
    const x = r.rows[0];
    return x ? { id: x.id, fincaId: x.finca_id, estado: x.estado, total: x.total, pagado: x.pagado } : null;
  }

  async marcarRecibida(tx: Transaccion, compraId: string, fecha: string, usuarioId: string): Promise<void> {
    await clienteDe(tx).query("UPDATE compra SET estado = 'recibida', fecha_recepcion = $2, recibido_por = $3 WHERE id = $1 AND estado = 'pedida'", [compraId, fecha, usuarioId]);
  }

  async buscarPagoProveedorPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM pago_proveedor WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async insertarPagoProveedor(tx: Transaccion, p: Parameters<RepositorioFinanzas["insertarPagoProveedor"]>[1]): Promise<string> {
    const c = clienteDe(tx);
    const r = await c.query(
      "INSERT INTO pago_proveedor (organizacion_id, compra_id, monto, metodo, fecha, clave_idempotencia, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [p.organizacionId, p.compraId, p.monto, p.metodo, p.fecha, p.clave, p.registradoPor],
    );
    await c.query("UPDATE compra SET pagado = pagado + $2 WHERE id = $1", [p.compraId, p.monto]);
    return r.rows[0].id as string;
  }

  // Métodos de pago y tipos de gasto: valen los de la base del sistema y los propios de las fincas de la persona.
  async metodoExiste(tx: Transaccion, organizacionId: string, codigo: string, fincaIds: readonly string[]): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM catalogo_valor WHERE organizacion_id = $1 AND catalogo = 'metodo_pago' AND codigo = $2 AND activo AND (finca_id IS NULL OR finca_id = ANY($3::uuid[]))", [organizacionId, codigo, fincaIds]);
    return (r.rowCount ?? 0) > 0;
  }

  async tipoGastoExiste(tx: Transaccion, organizacionId: string, codigo: string, fincaIds: readonly string[]): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM catalogo_valor WHERE organizacion_id = $1 AND catalogo = 'tipo_gasto' AND codigo = $2 AND activo AND (finca_id IS NULL OR finca_id = ANY($3::uuid[]))", [organizacionId, codigo, fincaIds]);
    return (r.rowCount ?? 0) > 0;
  }

  async loteEsDeFinca(tx: Transaccion, organizacionId: string, loteId: string, fincaId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM lote WHERE id = $1 AND finca_id = $2 AND organizacion_id = $3", [loteId, fincaId, organizacionId]);
    return r.rowCount === 1;
  }

  async listarCompras(tx: Transaccion, organizacionId: string, fincaIds: readonly string[]): Promise<FilaCompra[]> {
    const r = await clienteDe(tx).query(
      `SELECT c.id, c.numero, c.fecha::text AS fecha, f.nombre AS finca, p.nombre AS proveedor, c.estado, c.total, c.pagado, (c.total - c.pagado) AS saldo,
              (SELECT json_agg(json_build_object('descripcion', d.descripcion, 'cantidad', d.cantidad, 'unidad', d.unidad, 'costoUnitario', d.costo_unitario, 'subtotal', d.subtotal) ORDER BY d.id)
                 FROM compra_detalle d WHERE d.compra_id = c.id) AS lineas
         FROM compra c JOIN finca f ON f.id = c.finca_id JOIN proveedor p ON p.id = c.proveedor_id
        WHERE c.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[]) ORDER BY c.fecha DESC, c.numero DESC LIMIT 200`,
      [organizacionId, fincaIds],
    );
    return r.rows.map((x) => ({ id: x.id, numero: String(x.numero), fecha: x.fecha, fincaNombre: x.finca, proveedorNombre: x.proveedor, estado: x.estado, total: x.total, pagado: x.pagado, saldo: x.saldo, lineas: (x.lineas ?? []) as LineaCompra[] }));
  }

  async buscarGastoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM gasto WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async ventaEsDeFinca(tx: Transaccion, organizacionId: string, ventaId: string, fincaId: string): Promise<boolean> {
    return (await clienteDe(tx).query("SELECT 1 FROM venta WHERE id = $1 AND finca_id = $2 AND organizacion_id = $3", [ventaId, fincaId, organizacionId])).rowCount === 1;
  }

  async insertarGasto(tx: Transaccion, g: Parameters<RepositorioFinanzas["insertarGasto"]>[1]): Promise<string> {
    const r = await clienteDe(tx).query(
      `INSERT INTO gasto (organizacion_id, finca_id, lote_id, venta_id, tipo, clasificacion, fecha, descripcion, monto, metodo, clave_idempotencia, registrado_por)
       VALUES ($1,$2,$3,$12,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [g.organizacionId, g.fincaId, g.loteId ?? null, g.tipo, g.clasificacion, g.fecha, g.descripcion, g.monto, g.metodo ?? null, g.clave, g.registradoPor, g.ventaId ?? null],
    );
    return r.rows[0].id as string;
  }

  async listarGastos(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], desde: string, hasta: string): Promise<FilaGasto[]> {
    const r = await clienteDe(tx).query(
      `SELECT g.id, g.venta_id, g.fecha::text AS fecha, f.nombre AS finca, l.codigo AS lote, g.tipo, g.clasificacion, g.descripcion, g.monto
         FROM gasto g JOIN finca f ON f.id = g.finca_id LEFT JOIN lote l ON l.id = g.lote_id
        WHERE g.organizacion_id = $1 AND g.finca_id = ANY($2::uuid[]) AND g.fecha BETWEEN $3::date AND $4::date ORDER BY g.fecha DESC, g.creado_en DESC LIMIT 300`,
      [organizacionId, fincaIds, desde, hasta],
    );
    return r.rows.map((x) => ({ id: x.id, ventaId: x.venta_id, fecha: x.fecha, fincaNombre: x.finca, loteCodigo: x.lote, tipo: x.tipo, clasificacion: x.clasificacion, descripcion: x.descripcion, monto: x.monto }));
  }

  async resumen(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], desde: string, hasta: string): Promise<ResumenFinanciero> {
    const r = await clienteDe(tx).query(
      `SELECT
        coalesce((SELECT sum(v.total) FROM venta v WHERE v.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[]) AND v.estado = 'confirmada'
                    AND (v.fecha ${BOGOTA})::date BETWEEN $3::date AND $4::date), 0) AS ingresos,
        coalesce((SELECT sum(p.monto) FROM pago_cliente p JOIN venta v ON v.id = p.venta_id WHERE p.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[])
                    AND (p.fecha ${BOGOTA})::date BETWEEN $3::date AND $4::date), 0) AS cobrado,
        coalesce((SELECT sum(v.total - coalesce((SELECT sum(p.monto) FROM pago_cliente p WHERE p.venta_id = v.id), 0)) FROM venta v
                   WHERE v.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[]) AND v.estado = 'confirmada'), 0) AS por_cobrar,
        coalesce((SELECT sum(g.monto) FROM gasto g WHERE g.organizacion_id = $1 AND g.finca_id = ANY($2::uuid[]) AND g.clasificacion = 'agricola'
                    AND g.fecha BETWEEN $3::date AND $4::date), 0) AS gasto_agricola,
        coalesce((SELECT sum(g.monto) FROM gasto g WHERE g.organizacion_id = $1 AND g.finca_id = ANY($2::uuid[]) AND g.clasificacion = 'administrativo'
                    AND g.fecha BETWEEN $3::date AND $4::date), 0) AS gasto_admin,
        coalesce((SELECT sum(c.total) FROM compra c WHERE c.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[]) AND c.estado = 'recibida'
                    AND c.fecha_recepcion BETWEEN $3::date AND $4::date), 0) AS compras,
        coalesce((SELECT sum(l.neto) FROM liquidacion l WHERE l.organizacion_id = $1 AND (l.creada_en ${BOGOTA})::date BETWEEN $3::date AND $4::date
                    AND EXISTS (SELECT 1 FROM liquidacion_detalle d JOIN registro_trabajo w ON w.id = d.registro_trabajo_id WHERE d.liquidacion_id = l.id AND w.finca_id = ANY($2::uuid[]))), 0) AS mano_obra,
        coalesce((SELECT sum(p.monto) FROM pago_proveedor p JOIN compra c ON c.id = p.compra_id WHERE p.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[])
                    AND p.fecha BETWEEN $3::date AND $4::date), 0) AS pagos_proveedores,
        coalesce((SELECT sum(p.monto) FROM pago_trabajador p WHERE p.organizacion_id = $1 AND p.fecha BETWEEN $3::date AND $4::date
                    AND EXISTS (SELECT 1 FROM liquidacion_detalle d JOIN registro_trabajo w ON w.id = d.registro_trabajo_id WHERE d.liquidacion_id = p.liquidacion_id AND w.finca_id = ANY($2::uuid[]))), 0) AS pagos_trabajadores,
        coalesce((SELECT sum(c.total - c.pagado) FROM compra c WHERE c.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[]) AND c.estado = 'recibida'), 0) AS por_pagar_prov,
        coalesce((SELECT sum(l.neto - l.pagado) FROM liquidacion l WHERE l.organizacion_id = $1
                    AND EXISTS (SELECT 1 FROM liquidacion_detalle d JOIN registro_trabajo w ON w.id = d.registro_trabajo_id WHERE d.liquidacion_id = l.id AND w.finca_id = ANY($2::uuid[]))), 0) AS por_pagar_trab`,
      [organizacionId, fincaIds, desde, hasta],
    );
    const x = Object.fromEntries(Object.entries(r.rows[0]).map(([k, v]) => [k, sumar([String(v)])])) as Record<string, string>;
    const gastos = sumar([x.gasto_agricola, x.gasto_admin]);
    const egresos = sumar([gastos, x.compras, x.mano_obra]);
    return {
      desde, hasta,
      ingresosVentas: x.ingresos, cobrado: x.cobrado, cuentasPorCobrar: x.por_cobrar,
      gastosAgricolas: x.gasto_agricola, gastosAdministrativos: x.gasto_admin, comprasRecibidas: x.compras, manoObraLiquidada: x.mano_obra,
      costosProduccion: sumar([x.gasto_agricola, x.compras, x.mano_obra]),
      egresosDevengados: egresos, resultadoDevengado: restar(x.ingresos, egresos),
      pagosProveedores: x.pagos_proveedores, pagosTrabajadores: x.pagos_trabajadores, gastosPagados: gastos,
      flujoDeCaja: restar(x.cobrado, sumar([x.pagos_proveedores, x.pagos_trabajadores, gastos])),
      cuentasPorPagarProveedores: x.por_pagar_prov, cuentasPorPagarTrabajadores: x.por_pagar_trab,
    };
  }

  async conciliacion(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], desde: string, hasta: string): Promise<Conciliacion> {
    const r = await clienteDe(tx).query(
      `SELECT m.fecha::text AS fecha, m.concepto, m.tercero, m.metodo, m.entrada, m.salida FROM (
         SELECT (p.fecha ${BOGOTA})::date AS fecha, 'Cobro de la venta ' || v.numero_comprobante AS concepto, c.nombre AS tercero, p.metodo,
                p.monto AS entrada, 0::numeric AS salida
           FROM pago_cliente p JOIN venta v ON v.id = p.venta_id JOIN cliente c ON c.id = v.cliente_id
          WHERE p.organizacion_id = $1 AND v.finca_id = ANY($2::uuid[])
         UNION ALL
         SELECT p.fecha, 'Pago a proveedor · compra ' || c.numero, pr.nombre, p.metodo, 0::numeric, p.monto
           FROM pago_proveedor p JOIN compra c ON c.id = p.compra_id JOIN proveedor pr ON pr.id = c.proveedor_id
          WHERE p.organizacion_id = $1 AND c.finca_id = ANY($2::uuid[])
         UNION ALL
         SELECT p.fecha, 'Pago a trabajador', t.nombres || ' ' || t.apellidos, p.metodo_pago, 0::numeric, p.monto
           FROM pago_trabajador p JOIN liquidacion l ON l.id = p.liquidacion_id JOIN trabajador t ON t.id = l.trabajador_id
          WHERE p.organizacion_id = $1
            AND EXISTS (SELECT 1 FROM liquidacion_detalle d JOIN registro_trabajo w ON w.id = d.registro_trabajo_id WHERE d.liquidacion_id = l.id AND w.finca_id = ANY($2::uuid[]))
         UNION ALL
         SELECT g.fecha, g.descripcion, coalesce((SELECT cv.nombre FROM catalogo_valor cv WHERE cv.organizacion_id = g.organizacion_id AND cv.catalogo = 'tipo_gasto' AND cv.codigo = g.tipo), g.tipo), coalesce(g.metodo, 'sin_metodo'), 0::numeric, g.monto
           FROM gasto g WHERE g.organizacion_id = $1 AND g.finca_id = ANY($2::uuid[])
       ) m WHERE m.fecha BETWEEN $3::date AND $4::date ORDER BY m.fecha, m.concepto LIMIT 1000`,
      [organizacionId, fincaIds, desde, hasta],
    );
    const movimientos = r.rows.map((x) => ({ fecha: x.fecha as string, concepto: x.concepto as string, tercero: x.tercero as string, metodo: x.metodo as string, entrada: x.entrada as string, salida: x.salida as string }));
    const metodos = new Map<string, { entradas: string[]; salidas: string[] }>();
    for (const m of movimientos) {
      const acumulado = metodos.get(m.metodo) ?? { entradas: [], salidas: [] };
      acumulado.entradas.push(m.entrada);
      acumulado.salidas.push(m.salida);
      metodos.set(m.metodo, acumulado);
    }
    const porMetodo = [...metodos.entries()].map(([metodo, a]) => ({ metodo, entradas: sumar(a.entradas), salidas: sumar(a.salidas), neto: restar(sumar(a.entradas), sumar(a.salidas)) }));
    const totalEntradas = sumar(movimientos.map((m) => m.entrada));
    const totalSalidas = sumar(movimientos.map((m) => m.salida));
    return { desde, hasta, movimientos, porMetodo, totalEntradas, totalSalidas, neto: restar(totalEntradas, totalSalidas) };
  }
}
