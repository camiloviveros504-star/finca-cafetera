export const moneda = (valor: string | number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(valor));

export const cantidad = (valor: string | number) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Number(valor));

export const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(iso));
