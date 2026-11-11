/**
 * CSV generado en el servidor. Cada celda se escapa y se neutraliza la inyección de fórmulas: un texto que empieza por
 * = + - @ se antepone con una comilla para que una hoja de cálculo no lo ejecute.
 */
function celda(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(texto) && !/^-?\d+([.,]\d+)?$/.test(texto)) texto = `'${texto}`;
  return /[",\n\r;]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function aCsv(encabezados: string[], filas: unknown[][]): string {
  const lineas = [encabezados, ...filas].map((f) => f.map(celda).join(","));
  return "﻿" + lineas.join("\r\n") + "\r\n"; // BOM para que Excel respete las tildes
}
