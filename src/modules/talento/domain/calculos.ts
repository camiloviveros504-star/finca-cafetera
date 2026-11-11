/**
 * Cálculos puros de remuneración. Aritmética decimal exacta (enteros escalados), nunca float.
 * Ejemplo ilustrativo: tarifa de 1.500 por kg y 80 kg validados → 120.000.
 */
import { aEscala, aplicarFactor, ESCALA_CANTIDAD, ESCALA_MONTO, deEscala, multiplicarCantidadPorPrecio } from "@/shared/dominio/decimal";
import { ErrorRegla } from "@/shared/dominio/errores";

export type Modalidad = "kg" | "arroba" | "jornada" | "actividad";

/** Tipo de tarifa que remunera cada modalidad. La modalidad no se asume: viene de la vinculación. */
export const TIPO_TARIFA_POR_MODALIDAD: Record<Modalidad, string> = {
  kg: "pago_kg",
  arroba: "pago_arroba",
  jornada: "pago_jornada",
  actividad: "pago_actividad",
};

/**
 * Convierte la cantidad declarada a la unidad de la modalidad. Solo kg y arroba son convertibles entre sí,
 * con el factor configurado (arroba → kg, escala 6). Si la unidad no coincide con la modalidad se rechaza.
 */
export function convertirAUnidadDeModalidad(cantidad: bigint, unidadDeclarada: string, modalidad: Modalidad, factorArrobaAKg: bigint | null): bigint {
  if (unidadDeclarada === modalidad) return cantidad;
  if (unidadDeclarada === "kg" && modalidad === "arroba" && factorArrobaAKg) {
    return (cantidad * 1_000_000n + factorArrobaAKg / 2n) / factorArrobaAKg;
  }
  if (unidadDeclarada === "arroba" && modalidad === "kg" && factorArrobaAKg) {
    return aplicarFactor(cantidad, factorArrobaAKg);
  }
  throw new ErrorRegla(`La unidad ${unidadDeclarada} no corresponde a la modalidad de pago ${modalidad}`, "unidad_no_corresponde");
}

/** Valor del trabajo: cantidad validada × tarifa vigente en la fecha de la producción. */
export function calcularValor(cantidadValidada: string, valorUnitario: string): string {
  const monto = multiplicarCantidadPorPrecio(aEscala(cantidadValidada, ESCALA_CANTIDAD), aEscala(valorUnitario, ESCALA_MONTO));
  return deEscala(monto, ESCALA_MONTO);
}

export interface AnticipoPendiente {
  id: string;
  saldo: string;
}

/** Reparte el descuento de anticipos del más antiguo al más reciente sin superar el tope ni el saldo de cada uno. */
export function repartirAnticipos(anticipos: AnticipoPendiente[], tope: string): { anticipoId: string; monto: string }[] {
  let restante = aEscala(tope, ESCALA_MONTO);
  const resultado: { anticipoId: string; monto: string }[] = [];
  for (const a of anticipos) {
    if (restante <= 0n) break;
    const saldo = aEscala(a.saldo, ESCALA_MONTO);
    const monto = saldo < restante ? saldo : restante;
    if (monto > 0n) {
      resultado.push({ anticipoId: a.id, monto: deEscala(monto, ESCALA_MONTO) });
      restante -= monto;
    }
  }
  return resultado;
}

export function sumar(montos: string[]): string {
  return deEscala(montos.reduce((s, m) => s + aEscala(m, ESCALA_MONTO), 0n), ESCALA_MONTO);
}
export function restar(a: string, b: string): string {
  return deEscala(aEscala(a, ESCALA_MONTO) - aEscala(b, ESCALA_MONTO), ESCALA_MONTO);
}
export function minimo(a: string, b: string): string {
  return aEscala(a, ESCALA_MONTO) <= aEscala(b, ESCALA_MONTO) ? a : b;
}
export function mayorQue(a: string, b: string): boolean {
  return aEscala(a, ESCALA_MONTO) > aEscala(b, ESCALA_MONTO);
}
