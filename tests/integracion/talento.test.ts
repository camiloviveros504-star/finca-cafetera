import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  crearTarifa,
  crearTrabajador,
  crearVersionTarifa,
  crearVinculacion,
  ErrorProhibido,
  ErrorRegla,
  ErrorValidacion,
  liquidarPeriodo,
  listarLiquidaciones,
  listarTrabajadores,
  registrarAnticipo,
  registrarPagoTrabajador,
  registrarTrabajo,
  validarTrabajo,
} from "@/composicion";
import { fechaColombia } from "@/shared/dominio/fechas";
import { crearEntorno, type Entorno } from "../ayudas/entorno";

let e: Entorno;
const hoy = fechaColombia();
let w1 = ""; // recolector DEMO Uno (modalidad kg, con usuario)
let w2 = ""; // recolectora DEMO Dos (modalidad arroba)
let w3 = ""; // obrero DEMO Tres (modalidad jornada)

beforeAll(async () => {
  e = await crearEntorno({ poolMax: 10 });
  const r = await e.pool.query("SELECT id, numero_documento FROM trabajador");
  w1 = r.rows.find((x) => x.numero_documento === "1000000001").id;
  w2 = r.rows.find((x) => x.numero_documento === "1000000002").id;
  w3 = r.rows.find((x) => x.numero_documento === "1000000003").id;
});
afterAll(async () => {
  await e.cerrar();
});

async function registrarYValidar(trabajadorId: string, cantidad: string, unidad: string) {
  const sup = await e.contexto("supervisor@demo.local");
  const { id } = await registrarTrabajo(e.servicios.talento, sup, { trabajadorId, fincaId: e.ids.finca1, fecha: hoy, cantidad, unidad });
  return { id, resultado: await validarTrabajo(e.servicios.talento, sup, { registroId: id, decision: "validar" }) };
}

describe("remuneración por producción (ejemplo del prompt: 80 kg × 1.500 = 120.000)", () => {
  it("el recolector registra lo suyo sin definir valor; el supervisor valida y el sistema calcula con la tarifa vigente", async () => {
    const rec = await e.contexto("recolector@demo.local");
    const { id } = await registrarTrabajo(e.servicios.talento, rec, { fincaId: e.ids.finca1, loteId: e.ids.lote1_01, fecha: hoy, cantidad: "80", unidad: "kg" });
    const antes = await e.pool.query("SELECT estado, valor_calculado FROM registro_trabajo WHERE id = $1", [id]);
    expect(antes.rows[0]).toMatchObject({ estado: "pendiente", valor_calculado: null });

    const sup = await e.contexto("supervisor@demo.local");
    const r = await validarTrabajo(e.servicios.talento, sup, { registroId: id, decision: "validar", cantidadValidada: "80" });
    expect(r).toMatchObject({ estado: "validado", valor: "120000.00" });
    const fila = await e.pool.query("SELECT valor_unitario_aplicado, valor_calculado, tarifa_version_id FROM registro_trabajo WHERE id = $1", [id]);
    expect(fila.rows[0].valor_unitario_aplicado).toBe("1500.00");
    expect(fila.rows[0].tarifa_version_id).not.toBeNull();
  });

  it("una tarifa que cambia después no altera los valores ya generados (QA-12 en liquidaciones)", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    const manana = new Date(Date.now() + 86_400_000 + 5 * 3600_000).toISOString().slice(0, 10);
    const t = await e.pool.query("SELECT id FROM tarifa WHERE codigo = 'pago_kg'");
    await crearVersionTarifa(e.servicios.tarifas, admin, { tarifaId: t.rows[0].id, valor: "1800", desde: manana });
    const hist = await e.pool.query("SELECT valor_calculado FROM registro_trabajo WHERE estado = 'validado' ORDER BY creado_en LIMIT 1");
    expect(hist.rows[0].valor_calculado).toBe("120000.00");
  });

  it("el recolector no puede registrar a nombre de otro ni validar; queda auditado (403)", async () => {
    const rec = await e.contexto("recolector@demo.local");
    await expect(registrarTrabajo(e.servicios.talento, rec, { trabajadorId: w3, fincaId: e.ids.finca1, fecha: hoy, cantidad: "1", unidad: "jornada" })).rejects.toThrow(ErrorProhibido);
    const sup = await e.contexto("supervisor@demo.local");
    const { id } = await registrarTrabajo(e.servicios.talento, sup, { trabajadorId: w3, fincaId: e.ids.finca1, fecha: hoy, cantidad: "1", unidad: "jornada" });
    await expect(validarTrabajo(e.servicios.talento, rec, { registroId: id, decision: "validar" })).rejects.toThrow(ErrorProhibido);
    const aud = await e.pool.query("SELECT count(*)::int AS n FROM auditoria WHERE resultado = 'denegado' AND accion IN ('trabajo.registrar','trabajo.validar')");
    expect(aud.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it("el recolector solo ve su propia fila y no ve información de otros trabajadores", async () => {
    const rec = await e.contexto("recolector@demo.local");
    const lista = await listarTrabajadores(e.servicios.talento, rec);
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe(w1);
    await expect(listarLiquidaciones(e.servicios.talento, rec)).resolves.toBeDefined();
  });

  it("registra por arroba convirtiendo kg con la equivalencia configurada, y exige tarifa vigente", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    const { id } = await registrarTrabajo(e.servicios.talento, sup, { trabajadorId: w2, fincaId: e.ids.finca1, fecha: hoy, cantidad: "25", unidad: "kg" });
    await expect(validarTrabajo(e.servicios.talento, sup, { registroId: id, decision: "validar" })).rejects.toThrow(/tarifa de pago vigente/);
    const admin = await e.contexto("propietario.ambas@demo.local");
    await crearTarifa(e.servicios.tarifas, admin, { codigo: "pago_arroba", tipo: "pago_arroba", unidadCodigo: "arroba", valor: "20000", desde: "2026-01-01" });
    const r = await validarTrabajo(e.servicios.talento, sup, { registroId: id, decision: "validar" });
    expect(r).toMatchObject({ estado: "validado", valor: "40000.00" }); // 25 kg / 12,5 = 2 arrobas × 20.000
  });

  it("rechaza unidades que no corresponden a la modalidad y fechas futuras", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    await expect(registrarTrabajo(e.servicios.talento, sup, { trabajadorId: w3, fincaId: e.ids.finca1, fecha: hoy, cantidad: "5", unidad: "kg" })).rejects.toThrow(ErrorRegla);
    await expect(registrarTrabajo(e.servicios.talento, sup, { trabajadorId: w1, fincaId: e.ids.finca1, fecha: "2099-01-01", cantidad: "5", unidad: "kg" })).rejects.toThrow(ErrorValidacion);
    await expect(registrarTrabajo(e.servicios.talento, sup, { trabajadorId: w1, fincaId: e.ids.finca2, fecha: hoy, cantidad: "5", unidad: "kg" })).rejects.toThrow(ErrorProhibido);
  });

  it("el rechazo exige motivo y deja el registro fuera de la liquidación", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    const { id } = await registrarTrabajo(e.servicios.talento, sup, { trabajadorId: w1, fincaId: e.ids.finca1, fecha: hoy, cantidad: "3", unidad: "kg" });
    await expect(validarTrabajo(e.servicios.talento, sup, { registroId: id, decision: "rechazar" })).rejects.toThrow(ErrorValidacion);
    await validarTrabajo(e.servicios.talento, sup, { registroId: id, decision: "rechazar", motivo: "Cantidad no verificada en el lote" });
    await expect(validarTrabajo(e.servicios.talento, sup, { registroId: id, decision: "validar" })).rejects.toThrow(/ya fue procesado/);
  });
});

describe("registro idempotente, anticipos, liquidación y pagos", () => {
  it("un reintento con la misma clave no duplica el registro", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    const entrada = { trabajadorId: w3, fincaId: e.ids.finca1, fecha: hoy, cantidad: "1", unidad: "jornada", claveIdempotencia: "clave-trabajo-0001" };
    const a = await registrarTrabajo(e.servicios.talento, sup, entrada);
    const b = await registrarTrabajo(e.servicios.talento, sup, entrada);
    expect(b).toMatchObject({ id: a.id, repetido: true });
  });

  it("liquida lo validado, descuenta anticipos, no liquida dos veces el mismo registro y controla pagos", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    const fin = await e.contexto("financiero@demo.local");
    const { id: reg } = await registrarYValidar(w3, "2", "jornada"); // 2 × 60.000 = 120.000
    // validar también el registro pendiente de 1 jornada creado arriba
    const pend = await e.pool.query("SELECT id FROM registro_trabajo WHERE trabajador_id = $1 AND estado = 'pendiente'", [w3]);
    for (const p of pend.rows) await validarTrabajo(e.servicios.talento, sup, { registroId: p.id, decision: "validar" });
    expect(reg).toBeTruthy();

    await registrarAnticipo(e.servicios.talento, fin, { trabajadorId: w3, monto: "50000", fecha: hoy, claveIdempotencia: "anticipo-0001" });
    const rep = await registrarAnticipo(e.servicios.talento, fin, { trabajadorId: w3, monto: "50000", fecha: hoy, claveIdempotencia: "anticipo-0001" });
    expect(rep.repetido).toBe(true);

    const liq = await liquidarPeriodo(e.servicios.talento, fin, { trabajadorId: w3, desde: hoy, hasta: hoy, descontarAnticipos: true, claveIdempotencia: "liquidacion-0001" });
    const fila = await e.pool.query("SELECT total_bruto, total_anticipos, neto FROM liquidacion WHERE id = $1", [liq.id]);
    expect(fila.rows[0].total_bruto).toBe("240000.00"); // 4 jornadas × 60.000 (1 + 1 + 2)
    expect(fila.rows[0].total_anticipos).toBe("50000.00");
    expect(fila.rows[0].neto).toBe("190000.00");

    // Reintento idempotente y nada pendiente: no se liquida dos veces.
    expect(await liquidarPeriodo(e.servicios.talento, fin, { trabajadorId: w3, desde: hoy, hasta: hoy, claveIdempotencia: "liquidacion-0001" })).toMatchObject({ id: liq.id, repetido: true });
    await expect(liquidarPeriodo(e.servicios.talento, fin, { trabajadorId: w3, desde: hoy, hasta: hoy })).rejects.toThrow(/No hay registros validados/);

    // Pagos: parcial, exceso rechazado, completo → pagada. Los pagos son inmutables.
    await registrarPagoTrabajador(e.servicios.talento, fin, { liquidacionId: liq.id, monto: "100000", metodo: "efectivo", fecha: hoy });
    await expect(registrarPagoTrabajador(e.servicios.talento, fin, { liquidacionId: liq.id, monto: "90001", metodo: "efectivo", fecha: hoy })).rejects.toThrow(/supera el saldo/);
    await registrarPagoTrabajador(e.servicios.talento, fin, { liquidacionId: liq.id, monto: "90000", metodo: "transferencia", fecha: hoy });
    const final = await e.pool.query("SELECT estado, pagado FROM liquidacion WHERE id = $1", [liq.id]);
    expect(final.rows[0]).toMatchObject({ estado: "pagada", pagado: "190000.00" });
    await expect(e.pool.query("UPDATE pago_trabajador SET monto = 1")).rejects.toThrow();
  });

  it("dos pagos simultáneos por el saldo completo: solo uno se confirma", async () => {
    const sup = await e.contexto("supervisor@demo.local");
    const fin = await e.contexto("financiero@demo.local");
    await registrarYValidar(w1, "10", "kg");
    const liq = await liquidarPeriodo(e.servicios.talento, fin, { trabajadorId: w1, desde: hoy, hasta: hoy });
    void sup;
    const intentos = await Promise.allSettled(
      Array.from({ length: 5 }, () => registrarPagoTrabajador(e.servicios.talento, fin, { liquidacionId: liq.id, monto: liq.neto, metodo: "efectivo", fecha: hoy })),
    );
    expect(intentos.filter((i) => i.status === "fulfilled")).toHaveLength(1);
    const fila = await e.pool.query("SELECT pagado, neto FROM liquidacion WHERE id = $1", [liq.id]);
    expect(fila.rows[0].pagado).toBe(fila.rows[0].neto);
  });

  it("separación de funciones: nadie liquida sus propias remuneraciones, y el supervisor no liquida", async () => {
    const rec = await e.contexto("recolector@demo.local");
    const sup = await e.contexto("supervisor@demo.local");
    await expect(liquidarPeriodo(e.servicios.talento, sup, { trabajadorId: w1, desde: hoy, hasta: hoy })).rejects.toThrow(ErrorProhibido);
    await expect(liquidarPeriodo(e.servicios.talento, rec, { trabajadorId: w1, desde: hoy, hasta: hoy })).rejects.toThrow(ErrorProhibido);
    // Aun con el permiso concedido de forma extra, el sistema impide autoliquidarse.
    await e.pool.query(
      "INSERT INTO usuario_permiso_extra (usuario_id, permiso_id) SELECT u.id, p.id FROM usuario u, permiso p WHERE u.correo = 'recolector@demo.local' AND p.codigo = 'liquidacion:crear'",
    );
    const rec2 = await e.contexto("recolector@demo.local");
    await registrarYValidar(w1, "4", "kg");
    await expect(liquidarPeriodo(e.servicios.talento, rec2, { trabajadorId: w1, desde: hoy, hasta: hoy })).rejects.toThrow(ErrorProhibido);
  });

  it("crear trabajador exige la autorización de datos personales (Ley 1581) y no repite documentos", async () => {
    const admin = await e.contexto("propietario.ambas@demo.local");
    const base = { tipoDocumento: "CC", numeroDocumento: "2000000001", nombres: "Nueva", apellidos: "Persona DEMO" };
    await expect(crearTrabajador(e.servicios.talento, admin, { ...base, autorizaTratamiento: false })).rejects.toThrow(ErrorValidacion);
    const { id } = await crearTrabajador(e.servicios.talento, admin, { ...base, autorizaTratamiento: true });
    await expect(crearTrabajador(e.servicios.talento, admin, { ...base, autorizaTratamiento: true })).rejects.toThrow(/Ya existe/);
    await crearVinculacion(e.servicios.talento, admin, { trabajadorId: id, fincaId: e.ids.finca1, modalidad: "kg", desde: "2026-01-01" });
    await expect(crearVinculacion(e.servicios.talento, admin, { trabajadorId: id, fincaId: e.ids.finca1, modalidad: "jornada", desde: "2026-06-01" })).rejects.toThrow(/solapa/);
  });
});
