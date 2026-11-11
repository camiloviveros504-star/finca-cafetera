/**
 * Recolección completa en un solo formulario: lote, fecha, tipo de café y los kilos de cada trabajador con su valor por kilo.
 * Une dos módulos sin que se conozcan entre sí: la cosecha (entra a la bodega y suma al lote) y el pago de cada trabajador.
 * Es seguro reintentar: la cosecha usa la clave del formulario y cada trabajador una clave derivada de ella, de modo que si
 * la segunda parte falla (p. ej. un trabajador sin vincular) se corrige y se reenvía el mismo formulario sin duplicar nada.
 */
import { z } from "zod";
import { obtenerOpcionesRegistro, registrarCosecha, type DependenciasProduccion } from "@/modules/produccion/application/cosechas";
import { registrarJornada, type DependenciasTalento } from "@/modules/talento/application/talento";
import type { ContextoUsuario } from "@/shared/dominio/contexto";
import { aEscala, deEscala, ESCALA_CANTIDAD } from "@/shared/dominio/decimal";
import { ErrorRegla, ErrorValidacion } from "@/shared/dominio/errores";
/** Solo necesita estos dos servicios (se evita depender del tipo completo para no crear un ciclo con la raíz de composición). */
type ServiciosRecoleccion = { produccion: DependenciasProduccion; talento: DependenciasTalento };

const esquema = z.object({
  fincaId: z.string().uuid(),
  loteId: z.string().uuid({ message: "Seleccione el lote" }),
  productoId: z.string().uuid({ message: "Seleccione el tipo de café" }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  claveIdempotencia: z.string().uuid(),
  /** Kilos totales recogidos; si se omite, es la suma de los kilos de los trabajadores. */
  kgTotal: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, "Kilos inválidos").optional()),
  nota: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(300).optional()),
  lineas: z.array(z.object({ trabajadorId: z.string().uuid(), kg: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, "Kilos inválidos"), precioKg: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Valor inválido") })).max(60),
});

export async function registrarRecoleccion(s: ServiciosRecoleccion, ctx: ContextoUsuario, cruda: unknown) {
  const r = esquema.safeParse(cruda);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const p of r.error.issues) campos[p.path.join(".")] = p.message;
    throw new ErrorValidacion("Revise los datos de la recolección", campos);
  }
  const e = r.data;
  const suma = e.lineas.reduce((a, l) => a + aEscala(l.kg, ESCALA_CANTIDAD), 0n);
  const total = e.kgTotal ? aEscala(e.kgTotal, ESCALA_CANTIDAD) : suma;
  if (total <= 0n) throw new ErrorValidacion("Indique los kilos recogidos", { kgTotal: "Obligatorio" });
  if (suma > total) throw new ErrorValidacion("Los kilos de los trabajadores superan el total recogido", { kgTotal: "Menor que la suma de los trabajadores" });

  const opciones = await obtenerOpcionesRegistro(s.produccion, ctx);
  const bodega = opciones.bodegas.find((b) => b.fincaId === e.fincaId);
  const kg = opciones.unidades.find((u) => u.codigo === "kg");
  if (!bodega || !kg) throw new ErrorRegla("La finca no tiene bodega configurada", "bodega_invalida");

  const cosecha = await registrarCosecha(s.produccion, ctx, {
    fincaId: e.fincaId, loteId: e.loteId, bodegaId: bodega.id, productoId: e.productoId, unidadId: kg.id, fecha: e.fecha,
    cantidad: deEscala(total, ESCALA_CANTIDAD), claveIdempotencia: e.claveIdempotencia, nota: e.nota,
  });
  let pagos: { ids: string[]; total: string } = { ids: [], total: "0.00" };
  if (e.lineas.length > 0) {
    pagos = await registrarJornada(s.talento, ctx, {
      fincaId: e.fincaId, loteId: e.loteId, fecha: e.fecha, labor: "recoleccion", claveIdempotencia: e.claveIdempotencia,
      lineas: e.lineas.map((l) => ({ trabajadorId: l.trabajadorId, cantidad: l.kg, unidad: "kg", valorUnitario: l.precioKg })),
    });
  }
  return { cosechaId: cosecha.cosecha.id, repetida: cosecha.repetida, kg: deEscala(total, ESCALA_CANTIDAD), trabajadores: pagos.ids.length, totalPagar: pagos.total };
}
