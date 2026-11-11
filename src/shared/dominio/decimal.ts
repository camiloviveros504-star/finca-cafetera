/**
 * Aritmética decimal exacta con enteros escalados. Nunca se usa float para dinero ni cantidades.
 * Cantidades: escala 3 (numeric(14,3)). Montos: escala 2 (numeric(14,2)).
 */
export const ESCALA_CANTIDAD = 3;
export const ESCALA_MONTO = 2;

const PATRON = /^-?\d+(\.\d+)?$/;

export function aEscala(valor: string | number, escala: number): bigint {
  const texto = typeof valor === "number" ? String(valor) : valor.trim();
  if (!PATRON.test(texto)) throw new Error(`Número decimal inválido: ${texto}`);
  const negativo = texto.startsWith("-");
  const [entera, fraccion = ""] = texto.replace("-", "").split(".");
  const fraccionAjustada = (fraccion + "0".repeat(escala)).slice(0, escala);
  const redondeaArriba = fraccion.length > escala && Number(fraccion[escala]) >= 5;
  let n = BigInt(entera + fraccionAjustada);
  if (redondeaArriba) n += 1n;
  return negativo ? -n : n;
}

export function deEscala(n: bigint, escala: number): string {
  const negativo = n < 0n;
  const abs = (negativo ? -n : n).toString().padStart(escala + 1, "0");
  const entera = abs.slice(0, abs.length - escala);
  const fraccion = abs.slice(abs.length - escala);
  return `${negativo ? "-" : ""}${entera}${escala > 0 ? "." + fraccion : ""}`;
}

/** cantidad (escala 3) × precio (escala 2) → monto (escala 2), redondeo half-up. */
export function multiplicarCantidadPorPrecio(cantidad: bigint, precio: bigint): bigint {
  return (cantidad * precio + 500n) / 1000n;
}

/** cantidad (escala 3) × factor (escala 6) → cantidad (escala 3), redondeo half-up. */
export function aplicarFactor(cantidad: bigint, factor: bigint): bigint {
  return (cantidad * factor + 500000n) / 1000000n;
}
