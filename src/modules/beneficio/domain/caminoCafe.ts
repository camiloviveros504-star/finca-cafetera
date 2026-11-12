/**
 * El camino del café después de recogerlo. Se recolecta rojo y avanza por estados; en cada estado vendible se puede
 * vender o seguir al siguiente paso. "En lavado" y "en secado" son el café mientras el paso dura: no se venden.
 * Los códigos coinciden con los productos y las etapas que crea la migración 0015 (preparar_camino_cafe).
 */
export interface EstadoCafe {
  codigo: string;
  nombre: string;
  /** Se puede vender en este estado. */
  vendible: boolean;
  /** El café está en un paso que dura (horas o días). */
  enProceso: boolean;
  /** Estado del camino principal; los demás son subproductos (pasilla, plumilla). */
  principal: boolean;
}

export const ESTADOS_CAFE: readonly EstadoCafe[] = [
  { codigo: "CER", nombre: "Rojo (recién recogido)", vendible: true, enProceso: false, principal: true },
  { codigo: "PLV", nombre: "En lavado", vendible: false, enProceso: true, principal: true },
  { codigo: "PHU", nombre: "Húmedo (lavado)", vendible: true, enProceso: false, principal: true },
  { codigo: "PSC", nombre: "En secado", vendible: false, enProceso: true, principal: true },
  { codigo: "PSE", nombre: "Seco (pergamino)", vendible: true, enProceso: false, principal: true },
  { codigo: "EXC", nombre: "Almendra (trillado)", vendible: true, enProceso: false, principal: true },
  { codigo: "TOS", nombre: "Tostado", vendible: true, enProceso: false, principal: true },
  { codigo: "MOL", nombre: "Molido (en polvo)", vendible: true, enProceso: false, principal: true },
  { codigo: "PAS", nombre: "Pasilla", vendible: true, enProceso: false, principal: false },
  { codigo: "PLU", nombre: "Plumilla", vendible: true, enProceso: false, principal: false },
];

export interface PasoCafe {
  /** Código de la etapa en el flujo `camino_cafe`. */
  codigo: string;
  nombre: string;
  entrada: string;
  salida: string;
  /** El paso no cambia el peso (solo cambia el estado): lo que sale es lo mismo que entra. */
  mismoPeso: boolean;
  ayuda: string;
}

export const PASOS_CAFE: readonly PasoCafe[] = [
  { codigo: "despulpado", nombre: "Despulpar", entrada: "CER", salida: "PLV", mismoPeso: false, ayuda: "Se le quita la pulpa al café rojo. Anote cuántos kilos rojos entraron y cuántos quedaron despulpados: pasan a lavado." },
  { codigo: "lavado", nombre: "Lavar", entrada: "PLV", salida: "PHU", mismoPeso: false, ayuda: "Termina la fermentación y el lavado. Anote cuántos kilos de café húmedo quedaron." },
  { codigo: "inicio_secado", nombre: "Poner a secar", entrada: "PHU", salida: "PSC", mismoPeso: true, ayuda: "El café húmedo entra al secador o al patio. Queda en secado hasta que lo termine." },
  { codigo: "secado", nombre: "Terminar el secado", entrada: "PSC", salida: "PSE", mismoPeso: false, ayuda: "Anote cuántos kilos de café en secado salieron y cuántos kilos de café seco (pergamino) quedaron." },
  { codigo: "trilla", nombre: "Trillar", entrada: "PSE", salida: "EXC", mismoPeso: false, ayuda: "Se le quita el pergamino al café seco. Anote los kilos de almendra que quedaron." },
  { codigo: "tostion", nombre: "Tostar", entrada: "EXC", salida: "TOS", mismoPeso: false, ayuda: "Anote los kilos de almendra que entraron y los de café tostado que salieron." },
  { codigo: "molienda", nombre: "Moler", entrada: "TOS", salida: "MOL", mismoPeso: false, ayuda: "Anote los kilos de café tostado que se molieron y los de café en polvo que salieron." },
];

export const nombreEstado = (codigo: string) => ESTADOS_CAFE.find((e) => e.codigo === codigo)?.nombre ?? codigo;
