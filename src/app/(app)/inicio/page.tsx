import Link from "next/link";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Inicio · Gestión de Finca Cafetera" };

export default async function Inicio() {
  const ctx = await exigirContexto();
  const accesos = [
    { href: "/cosechas/nueva", texto: "Registrar cosecha", permiso: "cosecha:registrar" },
    { href: "/ventas/nueva", texto: "Registrar venta", permiso: "venta:crear" },
    { href: "/inventario", texto: "Consultar inventario", permiso: "inventario:ver" },
    { href: "/ventas", texto: "Ver ventas y trazabilidad", permiso: "venta:ver" },
  ].filter((a) => ctx.permisos.has(a.permiso));
  return (
    <section>
      <h1 className="text-2xl font-extrabold">Hola, {ctx.nombre}</h1>
      <p className="mt-1 text-sm">Estas son las operaciones disponibles para su rol.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {accesos.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex min-h-16 items-center rounded-xl border-2 border-cafe/20 bg-white p-4 text-base font-bold hover:border-cafetal"
            >
              {a.texto}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
