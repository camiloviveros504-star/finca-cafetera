import type { Transaccion } from "@/shared/dominio/contexto";
import { ErrorRegla } from "@/shared/dominio/errores";
import { clienteDe } from "@/shared/infraestructura/baseDatos";
import type { Modalidad } from "../domain/calculos";
import type { FilaLiquidacion, FilaRegistroTrabajo, FilaTrabajador, RegistroParaValidar, RepositorioTalento } from "../domain/puertos";

const codigoError = (e: unknown) => (e as { code?: string }).code;

function aLiquidacion(x: Record<string, string>): FilaLiquidacion {
  return {
    id: x.id, trabajadorId: x.trabajador_id, trabajadorNombre: x.nombre, desde: x.desde, hasta: x.hasta,
    totalBruto: x.total_bruto, totalAnticipos: x.total_anticipos, neto: x.neto, pagado: x.pagado, saldo: x.saldo,
    estado: x.estado as FilaLiquidacion["estado"], creadaEn: x.creada_en,
  };
}
const SQL_LIQUIDACION = `SELECT l.id, l.trabajador_id, t.nombres || ' ' || t.apellidos AS nombre, lower(l.periodo)::text AS desde,
       (upper(l.periodo) - 1)::text AS hasta, l.total_bruto, l.total_anticipos, l.neto, l.pagado, (l.neto - l.pagado) AS saldo,
       l.estado, l.creada_en::text AS creada_en
  FROM liquidacion l JOIN trabajador t ON t.id = l.trabajador_id`;

export class RepositorioTalentoPg implements RepositorioTalento {
  async crearTrabajador(tx: Transaccion, t: Parameters<RepositorioTalento["crearTrabajador"]>[1]): Promise<string> {
    try {
      const r = await clienteDe(tx).query(
        `INSERT INTO trabajador (organizacion_id, usuario_id, tipo_documento, numero_documento, nombres, apellidos, telefono,
                                 autorizo_tratamiento_en, finalidad_tratamiento, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8, $9) RETURNING id`,
        [t.organizacionId, t.usuarioId ?? null, t.tipoDocumento, t.numeroDocumento, t.nombres, t.apellidos, t.telefono ?? null, t.finalidad, t.creadoPor],
      );
      return r.rows[0].id as string;
    } catch (error) {
      if (codigoError(error) === "23505") throw new ErrorRegla("Ya existe un trabajador con ese documento o ese usuario", "trabajador_duplicado");
      if (codigoError(error) === "23503") throw new ErrorRegla("El usuario indicado no existe", "usuario_invalido");
      throw error;
    }
  }

  async crearVinculacion(tx: Transaccion, v: Parameters<RepositorioTalento["crearVinculacion"]>[1]): Promise<string> {
    try {
      const r = await clienteDe(tx).query(
        `INSERT INTO vinculacion (organizacion_id, trabajador_id, finca_id, modalidad, cargo, vigencia)
         VALUES ($1,$2,$3,$4,$5, daterange($6::date, $7::date, '[)')) RETURNING id`,
        [v.organizacionId, v.trabajadorId, v.fincaId, v.modalidad, v.cargo ?? null, v.desde, v.hasta ?? null],
      );
      return r.rows[0].id as string;
    } catch (error) {
      if (codigoError(error) === "23P01") throw new ErrorRegla("El trabajador ya tiene una vinculación en esa finca que se solapa con ese período", "vinculacion_solapada");
      if (codigoError(error) === "23503") throw new ErrorRegla("La finca no existe", "finca_invalida");
      throw error;
    }
  }

  async vincularUsuario(tx: Transaccion, organizacionId: string, trabajadorId: string, usuarioId: string) {
    const c = clienteDe(tx);
    const t = await c.query("SELECT usuario_id FROM trabajador WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [trabajadorId, organizacionId]);
    const u = await c.query("SELECT 1 FROM usuario WHERE id = $1 AND organizacion_id = $2", [usuarioId, organizacionId]);
    if (!t.rows[0] || !u.rows[0]) return "no_encontrado" as const;
    if (t.rows[0].usuario_id) return "trabajador_con_usuario" as const;
    try {
      await c.query("UPDATE trabajador SET usuario_id = $2 WHERE id = $1", [trabajadorId, usuarioId]);
    } catch (error) {
      if (codigoError(error) === "23505") return "usuario_ya_vinculado" as const;
      throw error;
    }
    return "ok" as const;
  }

  async listarTrabajadores(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloUsuarioId?: string): Promise<FilaTrabajador[]> {
    const r = await clienteDe(tx).query(
      `SELECT t.id, t.usuario_id, t.tipo_documento || ' ' || t.numero_documento AS documento,
              t.nombres || ' ' || t.apellidos AS nombre, t.telefono, t.activo,
              coalesce((SELECT json_agg(json_build_object('fincaId', v.finca_id, 'fincaNombre', f.nombre, 'modalidad', v.modalidad,
                                                          'desde', lower(v.vigencia), 'hasta', upper(v.vigencia)) ORDER BY lower(v.vigencia))
                          FROM vinculacion v JOIN finca f ON f.id = v.finca_id WHERE v.trabajador_id = t.id), '[]'::json) AS vinc,
              (SELECT count(*)::int FROM registro_trabajo w WHERE w.trabajador_id = t.id AND w.estado = 'pendiente') AS pendientes,
              coalesce((SELECT sum(w.valor_calculado) FROM registro_trabajo w WHERE w.trabajador_id = t.id AND w.estado IN ('validado','liquidado')), 0) AS validado,
              coalesce((SELECT sum(l.neto) FROM liquidacion l WHERE l.trabajador_id = t.id), 0) AS liquidado,
              coalesce((SELECT sum(l.pagado) FROM liquidacion l WHERE l.trabajador_id = t.id), 0) AS pagado,
              coalesce((SELECT sum(a.monto - a.descontado) FROM anticipo a WHERE a.trabajador_id = t.id), 0) AS anticipos,
              coalesce((SELECT sum(l.neto - l.pagado) FROM liquidacion l WHERE l.trabajador_id = t.id), 0) AS saldo
         FROM trabajador t
        WHERE t.organizacion_id = $1
          AND ($3::uuid IS NULL OR t.usuario_id = $3)
          AND (NOT EXISTS (SELECT 1 FROM vinculacion v WHERE v.trabajador_id = t.id)
               OR EXISTS (SELECT 1 FROM vinculacion v WHERE v.trabajador_id = t.id AND v.finca_id = ANY($2::uuid[])))
        ORDER BY t.apellidos, t.nombres`,
      [organizacionId, fincaIds, soloUsuarioId ?? null],
    );
    return r.rows.map((x) => ({
      id: x.id, usuarioId: x.usuario_id, documento: x.documento, nombre: x.nombre, telefono: x.telefono, activo: x.activo,
      vinculaciones: (x.vinc as { fincaId: string; fincaNombre: string; modalidad: Modalidad; desde: string; hasta: string | null }[]).map((v) => ({ ...v })),
      registrosPendientes: x.pendientes,
      validadoValor: x.validado,
      liquidadoNeto: x.liquidado,
      pagado: x.pagado,
      saldoPendiente: x.saldo,
      anticiposPendientes: x.anticipos,
    }));
  }

  async trabajadorDeUsuario(tx: Transaccion, organizacionId: string, usuarioId: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM trabajador WHERE organizacion_id = $1 AND usuario_id = $2 AND activo", [organizacionId, usuarioId]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async trabajadorUsuario(tx: Transaccion, organizacionId: string, trabajadorId: string) {
    const r = await clienteDe(tx).query("SELECT usuario_id FROM trabajador WHERE id = $1 AND organizacion_id = $2", [trabajadorId, organizacionId]);
    return r.rows[0] ? { existe: true, usuarioId: r.rows[0].usuario_id as string | null } : { existe: false, usuarioId: null };
  }

  async vinculacionVigente(tx: Transaccion, organizacionId: string, trabajadorId: string, fincaId: string, fecha: string) {
    const r = await clienteDe(tx).query(
      "SELECT id, modalidad FROM vinculacion WHERE organizacion_id = $1 AND trabajador_id = $2 AND finca_id = $3 AND vigencia @> $4::date",
      [organizacionId, trabajadorId, fincaId, fecha],
    );
    return r.rows[0] ? { id: r.rows[0].id as string, modalidad: r.rows[0].modalidad as Modalidad } : null;
  }

  async loteEsDeFinca(tx: Transaccion, organizacionId: string, loteId: string, fincaId: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM lote WHERE id = $1 AND finca_id = $2 AND organizacion_id = $3", [loteId, fincaId, organizacionId]);
    return r.rowCount === 1;
  }

  async unidadId(tx: Transaccion, codigo: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM unidad WHERE codigo = $1", [codigo]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async buscarRegistroPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM registro_trabajo WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async insertarRegistro(tx: Transaccion, r: Parameters<RepositorioTalento["insertarRegistro"]>[1]): Promise<string> {
    const res = await clienteDe(tx).query(
      `INSERT INTO registro_trabajo (organizacion_id, finca_id, lote_id, trabajador_id, vinculacion_id, fecha, modalidad, actividad,
                                     cantidad_declarada, unidad_declarada_id, clave_idempotencia, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [r.organizacionId, r.fincaId, r.loteId ?? null, r.trabajadorId, r.vinculacionId, r.fecha, r.modalidad, r.actividad ?? null, r.cantidad, r.unidadId, r.clave ?? null, r.registradoPor],
    );
    return res.rows[0].id as string;
  }

  async bloquearRegistro(tx: Transaccion, organizacionId: string, id: string): Promise<RegistroParaValidar | null> {
    const r = await clienteDe(tx).query(
      `SELECT w.id, w.finca_id, w.trabajador_id, t.usuario_id, w.fecha::text AS fecha, w.modalidad, w.cantidad_declarada,
              u.codigo AS unidad, w.estado
         FROM registro_trabajo w JOIN trabajador t ON t.id = w.trabajador_id JOIN unidad u ON u.id = w.unidad_declarada_id
        WHERE w.id = $1 AND w.organizacion_id = $2 FOR UPDATE OF w`,
      [id, organizacionId],
    );
    const x = r.rows[0];
    return x
      ? { id: x.id, fincaId: x.finca_id, trabajadorId: x.trabajador_id, trabajadorUsuarioId: x.usuario_id, fecha: x.fecha, modalidad: x.modalidad, cantidadDeclarada: x.cantidad_declarada, unidadDeclarada: x.unidad, estado: x.estado }
      : null;
  }

  async validarRegistro(tx: Transaccion, v: Parameters<RepositorioTalento["validarRegistro"]>[1]): Promise<void> {
    await clienteDe(tx).query(
      `UPDATE registro_trabajo SET estado = 'validado', cantidad_validada = $2, tarifa_version_id = $3, valor_unitario_aplicado = $4,
              valor_calculado = $5, validado_por = $6, validado_en = now() WHERE id = $1 AND estado = 'pendiente'`,
      [v.id, v.cantidadValidada, v.tarifaVersionId, v.valorUnitario, v.valor, v.validadoPor],
    );
  }

  async rechazarRegistro(tx: Transaccion, v: { id: string; motivo: string; validadoPor: string }): Promise<void> {
    await clienteDe(tx).query("UPDATE registro_trabajo SET estado = 'rechazado', motivo_rechazo = $2, validado_por = $3, validado_en = now() WHERE id = $1 AND estado = 'pendiente'", [v.id, v.motivo, v.validadoPor]);
  }

  async listarRegistros(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], o: { estado?: string; trabajadorId?: string }): Promise<FilaRegistroTrabajo[]> {
    const r = await clienteDe(tx).query(
      `SELECT w.id, w.trabajador_id, t.nombres || ' ' || t.apellidos AS trabajador, w.finca_id, f.nombre AS finca, l.codigo AS lote,
              w.fecha::text AS fecha, w.modalidad, w.actividad, w.cantidad_declarada, u.codigo AS unidad, w.cantidad_validada,
              w.estado, w.valor_unitario_aplicado, w.valor_calculado, w.motivo_rechazo
         FROM registro_trabajo w
         JOIN trabajador t ON t.id = w.trabajador_id JOIN finca f ON f.id = w.finca_id JOIN unidad u ON u.id = w.unidad_declarada_id
         LEFT JOIN lote l ON l.id = w.lote_id
        WHERE w.organizacion_id = $1 AND w.finca_id = ANY($2::uuid[])
          AND ($3::text IS NULL OR w.estado = $3) AND ($4::uuid IS NULL OR w.trabajador_id = $4)
        ORDER BY w.fecha DESC, w.creado_en DESC LIMIT 200`,
      [organizacionId, fincaIds, o.estado ?? null, o.trabajadorId ?? null],
    );
    return r.rows.map((x) => ({
      id: x.id, trabajadorId: x.trabajador_id, trabajadorNombre: x.trabajador, fincaId: x.finca_id, fincaNombre: x.finca, loteCodigo: x.lote,
      fecha: x.fecha, modalidad: x.modalidad, actividad: x.actividad, cantidadDeclarada: x.cantidad_declarada, unidadDeclarada: x.unidad,
      cantidadValidada: x.cantidad_validada, estado: x.estado, valorUnitario: x.valor_unitario_aplicado, valor: x.valor_calculado, motivoRechazo: x.motivo_rechazo,
    }));
  }

  async registrosParaLiquidar(tx: Transaccion, organizacionId: string, trabajadorId: string, fincaIds: readonly string[], desde: string, hasta: string) {
    const r = await clienteDe(tx).query(
      `SELECT id, cantidad_validada, valor_unitario_aplicado, valor_calculado FROM registro_trabajo
        WHERE organizacion_id = $1 AND trabajador_id = $2 AND estado = 'validado' AND finca_id = ANY($3::uuid[])
          AND fecha BETWEEN $4::date AND $5::date ORDER BY fecha, id FOR UPDATE`,
      [organizacionId, trabajadorId, fincaIds, desde, hasta],
    );
    return r.rows.map((x) => ({ id: x.id as string, cantidadValidada: x.cantidad_validada as string, valorUnitario: x.valor_unitario_aplicado as string, valor: x.valor_calculado as string }));
  }

  async anticiposPendientes(tx: Transaccion, organizacionId: string, trabajadorId: string) {
    const r = await clienteDe(tx).query(
      "SELECT id, (monto - descontado) AS saldo FROM anticipo WHERE organizacion_id = $1 AND trabajador_id = $2 AND monto > descontado ORDER BY fecha, creado_en, id FOR UPDATE",
      [organizacionId, trabajadorId],
    );
    return r.rows.map((x) => ({ id: x.id as string, saldo: x.saldo as string }));
  }

  async buscarLiquidacionPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<FilaLiquidacion | null> {
    const r = await clienteDe(tx).query(`${SQL_LIQUIDACION} WHERE l.organizacion_id = $1 AND l.clave_idempotencia = $2`, [organizacionId, clave]);
    return r.rows[0] ? aLiquidacion(r.rows[0]) : null;
  }

  async insertarLiquidacion(tx: Transaccion, l: Parameters<RepositorioTalento["insertarLiquidacion"]>[1]): Promise<string> {
    const r = await clienteDe(tx).query(
      `INSERT INTO liquidacion (organizacion_id, trabajador_id, periodo, total_bruto, total_anticipos, neto, clave_idempotencia, liquidada_por, estado)
       VALUES ($1,$2, daterange($3::date, $4::date, '[]'), $5,$6,$7,$8,$9, CASE WHEN $7::numeric = 0 THEN 'pagada' ELSE 'liquidada' END) RETURNING id`,
      [l.organizacionId, l.trabajadorId, l.desde, l.hasta, l.totalBruto, l.totalAnticipos, l.neto, l.clave ?? null, l.liquidadaPor],
    );
    return r.rows[0].id as string;
  }

  async insertarDetalleLiquidacion(tx: Transaccion, d: { liquidacionId: string; registroId: string; cantidad: string; valorUnitario: string; valor: string }): Promise<void> {
    const c = clienteDe(tx);
    await c.query("INSERT INTO liquidacion_detalle (liquidacion_id, registro_trabajo_id, cantidad_liquidada, valor_unitario, valor) VALUES ($1,$2,$3,$4,$5)", [d.liquidacionId, d.registroId, d.cantidad, d.valorUnitario, d.valor]);
    await c.query("UPDATE registro_trabajo SET estado = 'liquidado' WHERE id = $1 AND estado = 'validado'", [d.registroId]);
  }

  async descontarAnticipo(tx: Transaccion, liquidacionId: string, anticipoId: string, monto: string): Promise<void> {
    const c = clienteDe(tx);
    await c.query("UPDATE anticipo SET descontado = descontado + $2 WHERE id = $1", [anticipoId, monto]);
    await c.query("INSERT INTO liquidacion_anticipo (liquidacion_id, anticipo_id, monto) VALUES ($1,$2,$3)", [liquidacionId, anticipoId, monto]);
  }

  async insertarAnticipo(tx: Transaccion, a: Parameters<RepositorioTalento["insertarAnticipo"]>[1]): Promise<string> {
    const r = await clienteDe(tx).query(
      "INSERT INTO anticipo (organizacion_id, trabajador_id, fecha, monto, nota, clave_idempotencia, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [a.organizacionId, a.trabajadorId, a.fecha, a.monto, a.nota ?? null, a.clave ?? null, a.registradoPor],
    );
    return r.rows[0].id as string;
  }

  async buscarAnticipoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM anticipo WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async bloquearLiquidacion(tx: Transaccion, organizacionId: string, id: string) {
    const r = await clienteDe(tx).query("SELECT neto, pagado FROM liquidacion WHERE id = $1 AND organizacion_id = $2 FOR UPDATE", [id, organizacionId]);
    return r.rows[0] ? { neto: r.rows[0].neto as string, pagado: r.rows[0].pagado as string } : null;
  }

  async buscarPagoPorClave(tx: Transaccion, organizacionId: string, clave: string): Promise<string | null> {
    const r = await clienteDe(tx).query("SELECT id FROM pago_trabajador WHERE organizacion_id = $1 AND clave_idempotencia = $2", [organizacionId, clave]);
    return r.rows[0] ? (r.rows[0].id as string) : null;
  }

  async insertarPago(tx: Transaccion, p: Parameters<RepositorioTalento["insertarPago"]>[1]): Promise<string> {
    const c = clienteDe(tx);
    const r = await c.query(
      "INSERT INTO pago_trabajador (organizacion_id, liquidacion_id, monto, metodo_pago, fecha, clave_idempotencia, registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [p.organizacionId, p.liquidacionId, p.monto, p.metodo, p.fecha, p.clave ?? null, p.registradoPor],
    );
    await c.query("UPDATE liquidacion SET pagado = pagado + $2, estado = CASE WHEN pagado + $2 = neto THEN 'pagada' ELSE estado END WHERE id = $1", [p.liquidacionId, p.monto]);
    return r.rows[0].id as string;
  }

  async metodoDePagoExiste(tx: Transaccion, organizacionId: string, codigo: string): Promise<boolean> {
    const r = await clienteDe(tx).query("SELECT 1 FROM catalogo_valor WHERE organizacion_id = $1 AND catalogo = 'metodo_pago' AND codigo = $2 AND activo", [organizacionId, codigo]);
    return r.rowCount === 1;
  }

  async listarLiquidaciones(tx: Transaccion, organizacionId: string, fincaIds: readonly string[], soloTrabajadorId?: string): Promise<FilaLiquidacion[]> {
    const r = await clienteDe(tx).query(
      `${SQL_LIQUIDACION}
        WHERE l.organizacion_id = $1 AND ($3::uuid IS NULL OR l.trabajador_id = $3)
          AND EXISTS (SELECT 1 FROM liquidacion_detalle d JOIN registro_trabajo w ON w.id = d.registro_trabajo_id
                       WHERE d.liquidacion_id = l.id AND w.finca_id = ANY($2::uuid[]))
        ORDER BY l.creada_en DESC LIMIT 200`,
      [organizacionId, fincaIds, soloTrabajadorId ?? null],
    );
    return r.rows.map(aLiquidacion);
  }
}
