import Link from "next/link";
import { Logo } from "../_componentes/Logo";
import { MenuUsuario } from "../_componentes/MenuUsuario";
import { PieDePagina } from "../_componentes/PieDePagina";
import { BarraInferior, BarraLateral, type EnlaceNav } from "../_componentes/Navegacion";
import { IndicadorSync, ProveedorSync } from "../_componentes/ProveedorSync";
import { exigirContexto } from "../_servidor/sesion";

/**
 * Menú por rol. Cada enlace aparece solo si la persona tiene el permiso (la validación real está en el servidor).
 * Lo de todos los días va arriba, agrupado; lo que se usa poco queda plegado en "Más herramientas".
 */
const MENU: Array<EnlaceNav & { permiso?: string }> = [
  { href: "/inicio", etiqueta: "Inicio", icono: "inicio" },
  { href: "/fincas", etiqueta: "Fincas", icono: "finca", permiso: "finca:administrar", grupo: "Plataforma" },
  { href: "/lotes", etiqueta: "Lotes", icono: "lote", permiso: "lote:ver", grupo: "Mi finca" },
  { href: "/cosechas", etiqueta: "Recolección", icono: "recoleccion", permiso: "cosecha:ver", grupo: "Mi finca" },
  { href: "/trabajo", etiqueta: "Labores", icono: "labores", permiso: "trabajo:validar", grupo: "Mi finca" },
  { href: "/trabajo", etiqueta: "Mi producción", icono: "labores", permiso: "trabajo:registrar_propio", grupo: "Mi finca" },
  { href: "/trabajadores", etiqueta: "Equipo", icono: "equipo", permiso: "trabajador:ver", grupo: "Mi finca" },
  { href: "/trabajadores", etiqueta: "Mis kilos y pagos", icono: "equipo", permiso: "trabajador:ver_propio", grupo: "Mi finca" },
  { href: "/sanidad", etiqueta: "Insumos y sanidad", icono: "insumo", permiso: "inspeccion:ver", grupo: "Insumos" },
  { href: "/sanidad", etiqueta: "Insumos", icono: "insumo", permiso: "agroquimico:ver", grupo: "Insumos" },
  { href: "/compras", etiqueta: "Compra de insumos", icono: "compra", permiso: "compra:ver", grupo: "Insumos" },
  { href: "/inventario", etiqueta: "Café en bodega", icono: "bodega", permiso: "inventario:ver", grupo: "Café y ventas" },
  { href: "/ventas", etiqueta: "Ventas", icono: "venta", permiso: "venta:ver", grupo: "Café y ventas" },
  { href: "/clientes", etiqueta: "Compradores", icono: "comprador", permiso: "cliente:ver", grupo: "Café y ventas" },
  { href: "/finanzas", etiqueta: "Billetera", icono: "billetera", permiso: "finanzas:ver", grupo: "Dinero" },
  { href: "/cartera", etiqueta: "Por cobrar", icono: "porCobrar", permiso: "pago:ver", grupo: "Dinero" },
  { href: "/liquidaciones", etiqueta: "Pagos a trabajadores", icono: "pagos", permiso: "liquidacion:ver", grupo: "Dinero" },
  { href: "/reportes", etiqueta: "Reportes", icono: "reporte", permiso: "reporte:ver", grupo: "Dinero" },
  { href: "/usuarios", etiqueta: "Cuentas", icono: "cuentas", permiso: "usuario:ver", grupo: "Administración" },
  { href: "/configuracion/general", etiqueta: "Ajustes", icono: "ajustes", permiso: "configuracion:ver", grupo: "Administración" },
  { href: "/auditoria", etiqueta: "Auditoría", icono: "auditoria", permiso: "auditoria:ver", grupo: "Administración" },
  // Herramientas que una finca usa poco: siguen disponibles, plegadas.
  { href: "/planificacion", etiqueta: "Planificación", icono: "planificacion", permiso: "planificacion:ver", secundario: true },
  { href: "/maquinaria", etiqueta: "Maquinaria", icono: "maquinaria", permiso: "equipo:ver", secundario: true },
  { href: "/beneficio", etiqueta: "Beneficio del café", icono: "beneficio", permiso: "proceso:ver", secundario: true },
  { href: "/inventario/operaciones", etiqueta: "Ajustes de inventario", icono: "ajusteInventario", permiso: "inventario:ajustar", secundario: true },
];

/** El administrador de la plataforma ve lo suyo y, en solo lectura, los datos globales; nada operativo de una finca. */
const MENU_ADMINISTRADOR: Record<string, string> = {
  "/fincas": "Plataforma", "/usuarios": "Plataforma", "/configuracion/general": "Plataforma", "/auditoria": "Plataforma",
  "/lotes": "Datos globales", "/cosechas": "Datos globales", "/inventario": "Datos globales", "/ventas": "Datos globales", "/finanzas": "Datos globales", "/reportes": "Datos globales",
};

export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const ctx = await exigirContexto();
  const vistos = new Set<string>();
  let enlaces: EnlaceNav[] = MENU.filter((e) => {
    if ((e.permiso && !ctx.permisos.has(e.permiso)) || vistos.has(e.href)) return false;
    vistos.add(e.href);
    return true;
  }).map(({ href, etiqueta, icono, grupo, secundario }) => ({ href, etiqueta, icono, grupo, secundario }));
  if (ctx.permisos.has("finca:administrar")) {
    const orden = Object.keys(MENU_ADMINISTRADOR);
    enlaces = [
      ...enlaces.filter((e) => e.href === "/inicio"),
      ...enlaces.filter((e) => orden.includes(e.href)).sort((a, b) => orden.indexOf(a.href) - orden.indexOf(b.href)).map((e) => ({ ...e, grupo: MENU_ADMINISTRADOR[e.href], secundario: false })),
    ];
  }

  return (
    <ProveedorSync csrfToken={ctx.csrfToken}>
      <div className="min-h-svh lg:pl-64">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-borde bg-white lg:flex">
          <Link href="/inicio" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-borde px-5">
            <Logo className="size-8" />
            <span className="text-sm font-bold leading-tight">Gestión de<br />Finca Cafetera</span>
          </Link>
          <BarraLateral enlaces={enlaces} />
        </aside>

        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-borde bg-white px-4 sm:px-6 lg:px-8">
          <Link href="/inicio" className="flex items-center gap-2 lg:hidden">
            <Logo className="size-8" />
            <span className="text-sm font-bold">Finca Cafetera</span>
          </Link>
          <span className="hidden lg:block" />
          <div className="flex items-center gap-2 sm:gap-3">
            <IndicadorSync />
            <MenuUsuario nombre={ctx.nombre} correo={ctx.correo} roles={[...ctx.roles]} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">{children}</main>
        <div className="mx-auto max-w-6xl pb-20 lg:pb-0"><PieDePagina /></div>
        <BarraInferior enlaces={enlaces} />
      </div>
    </ProveedorSync>
  );
}
