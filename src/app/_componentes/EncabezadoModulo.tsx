/**
 * Encabezado de cada módulo: título, una línea que dice para qué sirve y, opcionalmente, la acción principal a la derecha.
 * Sin fotos: en una herramienta de trabajo la imagen ocupa espacio y no aporta información.
 */
export function EncabezadoModulo({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-borde pb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {detalle && <p className="mt-1 max-w-3xl text-sm text-suave">{detalle}</p>}
      </div>
      {accion}
    </div>
  );
}
