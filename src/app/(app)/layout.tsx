import { MenuUsuario } from "../_componentes/MenuUsuario";
import { PieDePagina } from "../_componentes/PieDePagina";
import { BarraInferior, BarraLateral, type EnlaceNav } from "../_componentes/Navegacion";
import { IndicadorSync, ProveedorSync } from "../_componentes/ProveedorSync";
import { exigirContexto } from "../_servidor/sesion";

export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const ctx = await exigirContexto();
  // El menú solo muestra lo permitido; la validación real está en el servidor (cada caso de uso).
  const todos: Array<EnlaceNav & { permiso?: string }> = [
    { href: "/inicio", etiqueta: "Inicio", icono: "⌂" },
    { href: "/fincas", etiqueta: "Fincas", icono: "⌖", permiso: "finca:administrar", grupo: "Plataforma" },
    // Mi finca: lo que se hace día a día en los lotes y con el personal.
    { href: "/lotes", etiqueta: "Lotes", icono: "◩", permiso: "lote:ver", grupo: "Mi finca" },
    { href: "/cosechas", etiqueta: "Recolección", icono: "☘", permiso: "cosecha:ver", grupo: "Mi finca" },
    { href: "/trabajo", etiqueta: "Labores", icono: "⚒", permiso: "trabajo:validar", grupo: "Mi finca" },
    { href: "/trabajo", etiqueta: "Mi producción", icono: "⚒", permiso: "trabajo:registrar_propio", grupo: "Mi finca" },
    { href: "/trabajadores", etiqueta: "Equipo", icono: "☻", permiso: "trabajador:ver", grupo: "Mi finca" },
    { href: "/trabajadores", etiqueta: "Mis kilos y pagos", icono: "☻", permiso: "trabajador:ver_propio", grupo: "Mi finca" },
    { href: "/planificacion", etiqueta: "Planificación", icono: "◷", permiso: "planificacion:ver", grupo: "Mi finca" },
    // Insumos y maquinaria.
    { href: "/sanidad", etiqueta: "Insumos y sanidad", icono: "✚", permiso: "inspeccion:ver", grupo: "Insumos" },
    { href: "/sanidad", etiqueta: "Insumos", icono: "✚", permiso: "agroquimico:ver", grupo: "Insumos" },
    { href: "/compras", etiqueta: "Compra de insumos", icono: "⛟", permiso: "compra:ver", grupo: "Insumos" },
    { href: "/maquinaria", etiqueta: "Maquinaria", icono: "⚙", permiso: "equipo:ver", grupo: "Insumos" },
    // Café, ventas y cobros.
    { href: "/inventario", etiqueta: "Café en bodega", icono: "▦", permiso: "inventario:ver", grupo: "Café y ventas" },
    { href: "/beneficio", etiqueta: "Beneficio", icono: "≋", permiso: "proceso:ver", grupo: "Café y ventas" },
    { href: "/ventas", etiqueta: "Ventas", icono: "$", permiso: "venta:ver", grupo: "Café y ventas" },
    { href: "/clientes", etiqueta: "Compradores", icono: "☺", permiso: "cliente:ver", grupo: "Café y ventas" },
    { href: "/cartera", etiqueta: "Cartera", icono: "◔", permiso: "pago:ver", grupo: "Café y ventas" },
    { href: "/inventario/operaciones", etiqueta: "Ajustes de inventario", icono: "⇄", permiso: "inventario:ajustar", grupo: "Café y ventas" },
    // Dinero.
    { href: "/finanzas", etiqueta: "Gastos y fletes", icono: "▤", permiso: "finanzas:ver", grupo: "Dinero" },
    { href: "/liquidaciones", etiqueta: "Pagos a trabajadores", icono: "¤", permiso: "liquidacion:ver", grupo: "Dinero" },
    { href: "/reportes", etiqueta: "Reportes", icono: "⇩", permiso: "reporte:ver", grupo: "Dinero" },
    // Administración.
    { href: "/usuarios", etiqueta: "Cuentas", icono: "♟", permiso: "usuario:ver", grupo: "Administración" },
    { href: "/configuracion/general", etiqueta: "Ajustes", icono: "☰", permiso: "configuracion:ver", grupo: "Administración" },
    { href: "/auditoria", etiqueta: "Auditoría", icono: "✓", permiso: "auditoria:ver", grupo: "Administración" },
  ];
  const vistos = new Set<string>();
  let enlaces = todos.filter((e) => {
    if ((e.permiso && !ctx.permisos.has(e.permiso)) || vistos.has(e.href)) return false;
    vistos.add(e.href);
    return true;
  });
  // El administrador de la plataforma ve primero lo suyo (fincas, cuentas, ajustes, auditoría) y después, en solo lectura,
  // los datos globales. Lo operativo de cada finca (equipo, insumos, compras…) es de su propietario y no aparece aquí.
  if (ctx.permisos.has("finca:administrar")) {
    const PLATAFORMA = ["/fincas", "/usuarios", "/configuracion/general", "/auditoria"];
    const GLOBAL = ["/lotes", "/cosechas", "/inventario", "/ventas", "/finanzas", "/reportes"];
    const propios = enlaces.filter((e) => PLATAFORMA.includes(e.href)).sort((a, b) => PLATAFORMA.indexOf(a.href) - PLATAFORMA.indexOf(b.href)).map((e) => ({ ...e, grupo: "Plataforma" }));
    const globales = enlaces.filter((e) => GLOBAL.includes(e.href)).sort((a, b) => GLOBAL.indexOf(a.href) - GLOBAL.indexOf(b.href)).map((e) => ({ ...e, grupo: "Datos globales (consulta)" }));
    enlaces = [...enlaces.filter((e) => e.href === "/inicio"), ...propios, ...globales];
  }

  return (
    <ProveedorSync csrfToken={ctx.csrfToken}>
      <div className="min-h-svh">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-tinta px-4 py-2 text-white sm:px-6">
          <span className="min-w-0 truncate text-base font-extrabold tracking-tight"><span className="sm:hidden">Finca Cafetera</span><span className="hidden sm:inline">Gestión de Finca Cafetera</span></span>
          <div className="flex items-center gap-3 text-sm">
            <IndicadorSync />
            <MenuUsuario nombre={ctx.nombre} correo={ctx.correo} roles={[...ctx.roles]} />
          </div>
        </header>
        <div className="mx-auto flex max-w-7xl">
          <BarraLateral enlaces={enlaces} />
          <div className="min-w-0 flex-1">
            <main className="px-4 pb-6 pt-4 sm:px-6 lg:px-8">{children}</main>
            <div className="pb-20 lg:pb-0"><PieDePagina /></div>
          </div>
        </div>
        <BarraInferior enlaces={enlaces} />
      </div>
    </ProveedorSync>
  );
}
