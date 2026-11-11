/** Operaciones sobre montos con 2 decimales, en enteros escalados (nunca float). */
import { aEscala, deEscala, ESCALA_MONTO } from "./decimal";

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
