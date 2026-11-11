/** Regla de dominio pura: de qué saldos se saca una cantidad, en el orden en que llegan (ya bloqueados). */
export interface SaldoCandidato {
  id: string;
  loteId: string;
  bodegaId: string;
  cantidad: bigint; // escala 3
}

export interface Asignacion {
  saldoId: string;
  loteId: string;
  bodegaId: string;
  cantidad: bigint; // escala 3
}

export interface ResultadoAsignacion {
  alcanza: boolean;
  disponible: bigint;
  asignaciones: Asignacion[];
}

export function asignarExistencias(saldos: readonly SaldoCandidato[], solicitada: bigint): ResultadoAsignacion {
  const disponible = saldos.reduce((suma, s) => suma + s.cantidad, 0n);
  if (solicitada <= 0n || disponible < solicitada) return { alcanza: false, disponible, asignaciones: [] };
  const asignaciones: Asignacion[] = [];
  let falta = solicitada;
  for (const s of saldos) {
    if (falta === 0n) break;
    if (s.cantidad <= 0n) continue;
    const toma = s.cantidad < falta ? s.cantidad : falta;
    asignaciones.push({ saldoId: s.id, loteId: s.loteId, bodegaId: s.bodegaId, cantidad: toma });
    falta -= toma;
  }
  return { alcanza: true, disponible, asignaciones };
}
