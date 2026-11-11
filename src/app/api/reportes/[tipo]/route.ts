import { NextResponse } from "next/server";
import {
  consultarAuditoria, consultarSaldos, ErrorNegocio, listarCosechas, listarLiquidaciones, listarVentas, obtenerConciliacion, servicios,
} from "@/composicion";
import { aCsv } from "../../../_servidor/csv";
import { contextoActual } from "../../../_servidor/sesion";

/**
 * Reportes en CSV generados en el servidor. Reutilizan los casos de uso de lectura: cada uno comprueba su propio
 * permiso y limita los datos a las fincas del usuario, además del permiso general `reporte:ver`.
 */
export async function GET(solicitud: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const ctx = await contextoActual();
  if (!ctx) return NextResponse.json({ error: "Debe iniciar sesión para continuar" }, { status: 401 });
  if (!ctx.permisos.has("reporte:ver")) return NextResponse.json({ error: "No tiene permiso para realizar esta operación" }, { status: 403 });
  const { tipo } = await params;
  const url = new URL(solicitud.url);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const desde = url.searchParams.get("desde") ?? `${hoy.slice(0, 8)}01`;
  const hasta = url.searchParams.get("hasta") ?? hoy;
  try {
    let csv: string;
    if (tipo === "ventas") {
      const filas = [];
      for (let p = 1; p <= 40; p++) {
        const r = await listarVentas(servicios().comercial, ctx, p);
        filas.push(...r.filas);
        if (filas.length >= r.total) break;
      }
      csv = aCsv(["comprobante", "fecha", "finca", "cliente", "estado", "total"], filas.map((v) => [v.numeroComprobante, v.fecha, v.fincaNombre, v.clienteNombre, v.estado, v.total]));
    } else if (tipo === "inventario") {
      const s = await consultarSaldos(servicios().inventario, ctx);
      csv = aCsv(["finca", "bodega", "producto", "lote", "cantidad_kg"], s.map((x) => [x.fincaNombre, x.bodegaNombre, x.productoNombre, x.loteCodigo, x.cantidad]));
    } else if (tipo === "cosechas") {
      const filas = [];
      for (let p = 1; p <= 40; p++) {
        const r = await listarCosechas(servicios().produccion, ctx, p);
        filas.push(...r.filas);
        if (filas.length >= r.total) break;
      }
      csv = aCsv(["fecha", "lote", "producto", "cantidad", "unidad", "estado"], filas.map((c) => [c.fecha, c.loteCodigo, c.productoNombre, c.cantidad, c.unidadCodigo, c.estado]));
    } else if (tipo === "liquidaciones") {
      const l = await listarLiquidaciones(servicios().talento, ctx);
      csv = aCsv(["trabajador", "desde", "hasta", "bruto", "anticipos", "neto", "pagado", "saldo", "estado"], l.map((x) => [x.trabajadorNombre, x.desde, x.hasta, x.totalBruto, x.totalAnticipos, x.neto, x.pagado, x.saldo, x.estado]));
    } else if (tipo === "conciliacion") {
      const c = await obtenerConciliacion(servicios().finanzas, ctx, desde, hasta);
      csv = aCsv(["fecha", "concepto", "tercero", "metodo", "entrada", "salida"], c.movimientos.map((m) => [m.fecha, m.concepto, m.tercero, m.metodo, m.entrada, m.salida]));
    } else if (tipo === "auditoria") {
      const a = await consultarAuditoria(servicios().auditoria, ctx, {}, 1, 100);
      csv = aCsv(["fecha", "usuario", "accion", "entidad", "resultado"], a.filas.map((f) => [f.fecha, f.usuario ?? "sistema", f.accion, f.entidad, f.resultado]));
    } else {
      return NextResponse.json({ error: "Reporte desconocido" }, { status: 404 });
    }
    return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${tipo}-${hoy}.csv"`, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ErrorNegocio) return NextResponse.json({ error: error.message }, { status: error.estadoHttp });
    console.error("Error no controlado en /api/reportes");
    return NextResponse.json({ error: "Ocurrió un error inesperado" }, { status: 500 });
  }
}
