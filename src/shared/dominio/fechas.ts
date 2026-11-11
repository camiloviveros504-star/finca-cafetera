/** Fecha calendario (AAAA-MM-DD) en la zona horaria de Colombia. */
export function fechaColombia(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}
