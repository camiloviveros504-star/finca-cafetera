import { accionCerrarSesion } from "../login/acciones";
import { BarraInferior, BarraLateral, type EnlaceNav } from "../_componentes/Navegacion";
import { IndicadorSync, ProveedorSync } from "../_componentes/ProveedorSync";
import { exigirContexto } from "../_servidor/sesion";

export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const ctx = await exigirContexto();
  // El menú solo muestra lo permitido; la validación real está en el servidor (cada caso de uso).
  const todos: Array<EnlaceNav & { permiso?: string }> = [
    { href: "/inicio", etiqueta: "Inicio", icono: "⌂" },
    { href: "/lotes", etiqueta: "Lotes", icono: "◩", permiso: "lote:ver" },
    { href: "/cosechas", etiqueta: "Cosechas", icono: "☘", permiso: "cosecha:ver" },
    { href: "/inventario", etiqueta: "Inventario", icono: "▦", permiso: "inventario:ver" },
    { href: "/ventas", etiqueta: "Ventas", icono: "$", permiso: "venta:ver" },
    { href: "/clientes", etiqueta: "Clientes", icono: "☺", permiso: "cliente:ver" },
    { href: "/pedidos", etiqueta: "Pedidos", icono: "☰", permiso: "pedido:ver" },
    { href: "/inventario/operaciones", etiqueta: "Movimientos", icono: "⇄", permiso: "inventario:ajustar" },
    { href: "/configuracion", etiqueta: "Tarifas", icono: "%", permiso: "tarifa:ver" },
    { href: "/beneficio", etiqueta: "Beneficio", icono: "≋", permiso: "proceso:ver" },
    { href: "/trabajadores", etiqueta: "Trabajadores", icono: "☻", permiso: "trabajador:ver" },
    { href: "/trabajadores", etiqueta: "Mis datos", icono: "☻", permiso: "trabajador:ver_propio" },
    { href: "/trabajo", etiqueta: "Producción", icono: "⚒", permiso: "trabajo:validar" },
    { href: "/trabajo", etiqueta: "Mi producción", icono: "⚒", permiso: "trabajo:registrar_propio" },
    { href: "/liquidaciones", etiqueta: "Liquidaciones", icono: "¤", permiso: "liquidacion:ver" },
    { href: "/cartera", etiqueta: "Cartera", icono: "◔", permiso: "pago:ver" },
    { href: "/compras", etiqueta: "Compras", icono: "⛟", permiso: "compra:ver" },
    { href: "/finanzas", etiqueta: "Finanzas", icono: "▤", permiso: "finanzas:ver" },
  ];
  const enlaces = todos.filter((e) => !e.permiso || ctx.permisos.has(e.permiso));

  return (
    <ProveedorSync csrfToken={ctx.csrfToken}>
      <div className="min-h-svh">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-cafe px-4 py-2 text-white sm:px-6">
          <span className="text-base font-extrabold">Finca Cafetera</span>
          <div className="flex items-center gap-3 text-sm">
            <IndicadorSync />
            <span className="hidden md:inline">
              {ctx.nombre} · {ctx.roles.join(", ").replaceAll("_", " ")}
            </span>
            <form action={accionCerrarSesion}>
              <button className="min-h-11 rounded-lg border-2 border-white/60 px-3 font-semibold hover:bg-white/10">Salir</button>
            </form>
          </div>
        </header>
        <div className="mx-auto flex max-w-7xl">
          <BarraLateral enlaces={enlaces} />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8">{children}</main>
        </div>
        <BarraInferior enlaces={enlaces} />
      </div>
    </ProveedorSync>
  );
}
