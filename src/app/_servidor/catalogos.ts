import "server-only";
import { opcionesDeCatalogo, servicios, type Catalogo } from "@/composicion";
import type { ContextoUsuario } from "@/shared/dominio/contexto";

/**
 * Opciones de un catálogo para los formularios: la base del sistema más lo que agregó el propietario para sus fincas
 * (Ajustes de mi finca). Así ningún formulario tiene la lista escrita en el código.
 */
export async function opcionesCatalogo(ctx: ContextoUsuario, catalogo: Catalogo) {
  return opcionesDeCatalogo(servicios().ajustes, ctx, catalogo).catch(() => [] as { valor: string; texto: string }[]);
}
