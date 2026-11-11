/**
 * Iconos de línea propios (24×24, trazo 1.8), sin librerías externas. Cada entrada es el contenido `d` de uno o más trazos.
 */
const TRAZOS = {
  inicio: ["M3 11.5 12 4l9 7.5", "M5.5 10v9.5h13V10", "M10 19.5v-5h4v5"],
  finca: ["M3 20h18", "M5 20V10l7-5 7 5v10", "M9.5 20v-5h5v5"],
  lote: ["M4 5h16v14H4z", "M4 12h16", "M12 5v14"],
  recoleccion: ["M12 21c-4.4 0-7-3.4-7-7.5C5 8.5 8.5 4 12 3c3.5 1 7 5.5 7 10.5 0 4.1-2.6 7.5-7 7.5Z", "M12 7c-1.8 2.5-1.8 7.5 0 10"],
  labores: ["M14.5 5.5 18.5 9.5", "M12 8l4 4-8.5 8.5H3.5v-4Z", "M16 4l4 4"],
  equipo: ["M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5", "M16 4.5a3.5 3.5 0 0 1 0 6.5", "M18 14.7c1.8.8 3 2.6 3.5 5.3"],
  insumo: ["M7 3h10l-1 4H8Z", "M8 7v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7", "M10 12h4"],
  compra: ["M3 4h2.5l2.2 11h10.6l2-8H6.6", "M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
  bodega: ["M3 9 12 4l9 5v11H3Z", "M7 20v-7h10v7", "M7 16.5h10"],
  venta: ["M4 7h16v10H4z", "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M7 10v4", "M17 10v4"],
  comprador: ["M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21c1-4 4.2-6 8-6s7 2 8 6"],
  porCobrar: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  billetera: ["M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3", "M4 7.5V18a2 2 0 0 0 2 2h14V8H6.5A2.5 2.5 0 0 1 4 5.5", "M16.5 14h.01"],
  pagos: ["M3 6h18v12H3z", "M3 10h18", "M7 15h3"],
  reporte: ["M6 3h9l4 4v14H6z", "M14 3v5h5", "M9 17v-3", "M12 17v-6", "M15 17v-2"],
  cuentas: ["M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M3 21c.9-3.8 3.6-6 7-6 1.5 0 2.8.4 3.9 1.1", "M18 15v6", "M15 18h6"],
  ajustes: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"],
  auditoria: ["M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6Z", "m9 12 2 2 4-4"],
  herramientas: ["M4 6h16", "M4 12h16", "M4 18h16"],
  beneficio: ["M4 18c2 1.3 4 1.3 6 0s4-1.3 6 0 3 1 4 .5", "M4 13c2 1.3 4 1.3 6 0s4-1.3 6 0 3 1 4 .5", "M12 3v6"],
  planificacion: ["M4 5h16v15H4z", "M4 9.5h16", "M8 3v4", "M16 3v4"],
  maquinaria: ["M6.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M17 19a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M4 13.5V8h7l2 5", "M11 8V5h4"],
  ajusteInventario: ["M4 8h13", "m14 5 3 3-3 3", "M20 16H7", "m10 13-3 3 3 3"],
  mas: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  salir: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  alerta: ["M12 9v4", "M12 17h.01", "M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"],
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className = "size-5" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {TRAZOS[nombre].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
