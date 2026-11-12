import Link from "next/link";
import { ErrorProhibido, listarFincasYLotes, listarTrabajadores, listarUsuarios, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { Tarjeta } from "../../_componentes/Pestanas";
import { exigirContexto } from "../../_servidor/sesion";
import { accionAsignar, accionEmitirEnlace, accionEstadoUsuario, accionInvitar, accionInvitarTrabajador, accionPermisoExtra } from "./acciones";

export const metadata = { title: "Cuentas · Gestión de Finca Cafetera" };

const NOMBRE_ROL: Record<string, string> = { administrador: "Administrador", propietario: "Propietario", capataz: "Capataz", trabajador: "Trabajador" };
const DESCRIPCION: Record<string, string> = {
  administrador: "Administra la plataforma: fincas, cuentas y ajustes. No opera ninguna finca.",
  propietario: "Dueño de una o varias fincas: maneja lotes, insumos, equipo, recolección, ventas y dinero.",
  capataz: "Anota la recolección, las labores y las aplicaciones de las fincas que se le asignen. No ve ventas ni dinero.",
  trabajador: "Consulta sus propios kilos, jornales y lo que le han pagado.",
};

function Estado({ activo, pendiente }: { activo: boolean; pendiente: boolean }) {
  const [texto, clase] = pendiente ? ["Pendiente de activar", "bg-ambar/10 text-ambar"] : activo ? ["Activa", "bg-bosque-claro text-bosque"] : ["Desactivada", "bg-alerta/10 text-alerta"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}>{texto}</span>;
}

export default async function Cuentas() {
  const ctx = await exigirContexto();
  let datos;
  try {
    datos = await listarUsuarios(servicios().usuarios, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar cuentas.</p>;
    throw error;
  }
  const administra = ctx.permisos.has("usuario:administrar");
  const invitaEquipo = !administra && ctx.permisos.has("usuario:invitar_equipo");
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const opcionesFinca = fincas.map((f) => ({ valor: f.id, texto: f.nombre }));
  const sinCuenta = invitaEquipo ? (await listarTrabajadores(servicios().talento, ctx).catch(() => [])).filter((w) => !w.usuarioId && w.vinculaciones.length > 0) : [];
  const ORDEN = ["propietario", "administrador", "capataz", "trabajador"];
  const rolesAsignables = datos.roles.filter((r) => NOMBRE_ROL[r.codigo]).sort((x, y) => ORDEN.indexOf(x.codigo) - ORDEN.indexOf(y.codigo)).map((r) => ({ valor: r.codigo, texto: `${NOMBRE_ROL[r.codigo]} — ${DESCRIPCION[r.codigo]}` }));
  const otraPersona = (u: { id: string }) => u.id !== ctx.usuarioId;

  return (
    <div className="space-y-6">
      <EncabezadoModulo
        titulo={administra ? "Cuentas de la plataforma" : "Cuentas de mi equipo"}
        detalle={administra
          ? "Usted crea las cuentas de los propietarios y de otros administradores. Los capataces y trabajadores los crea el propietario de cada finca."
          : "Cree la cuenta de su capataz (asignándole sus fincas) o la de un trabajador para que vea sus kilos. Cada persona crea su propia contraseña con el enlace."}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Tarjeta titulo={`Cuentas (${datos.usuarios.length})`} className="h-fit overflow-hidden !p-0 [&>h2]:mb-0 [&>h2]:border-b [&>h2]:border-borde [&>h2]:px-5 [&>h2]:py-3">
          {datos.usuarios.length === 0 ? <p className="p-5 text-sm text-suave">Todavía no hay cuentas.</p> : (
            <ul className="divide-y divide-borde">
              {datos.usuarios.map((u) => (
                <li key={u.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{u.nombre}</p>
                      <p className="text-xs text-suave">{u.correo}</p>
                      <p className="mt-1 text-xs text-suave">
                        {u.roles.map((r) => NOMBRE_ROL[r] ?? r.replaceAll("_", " ")).join(", ") || "Sin rol"}
                        {u.roles.includes("administrador") ? " · todas las fincas" : u.fincas.length > 0 ? ` · ${u.fincas.map((f) => f.nombre).join(", ")}` : " · sin finca"}
                      </p>
                      {u.equipo && <p className="mt-1 text-xs text-suave">Equipo: <span className="font-medium text-tinta">{u.equipo.capataces} capataz(ces)</span> · <span className="font-medium text-tinta">{u.equipo.trabajadores} trabajador(es)</span></p>}
                    </div>
                    <Estado activo={u.activo} pendiente={u.pendiente} />
                  </div>
                  {u.pendiente && !u.invitacionVigente && <p className="mt-2 text-xs font-medium text-alerta">El enlace venció: genere uno nuevo.</p>}
                  {(administra || invitaEquipo) && otraPersona(u) && (
                    <details className="mt-2">
                      <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-bosque">Administrar</summary>
                      <div className="mt-2 space-y-4 rounded-lg bg-fondo/70 p-4">
                        <div>
                          <p className="mb-1 text-xs text-suave">{u.pendiente ? "La persona aún no activa su cuenta." : "Para cambiar la contraseña se genera un enlace: la persona escribe la nueva. Nadie más la conoce."}</p>
                          <FormularioGenerico compacto accion={accionEmitirEnlace} boton={u.pendiente ? "Generar enlace de activación" : "Cambiar contraseña (generar enlace)"} ocultos={{ usuarioId: u.id }} campos={[]} />
                        </div>
                        {administra && (
                          <FormularioGenerico accion={accionAsignar} boton="Guardar rol y fincas" ocultos={{ usuarioId: u.id }} campos={[
                            { nombre: "roles", etiqueta: "Rol", tipo: "multiple", opciones: rolesAsignables, valorInicial: u.roles.join(",") },
                            { nombre: "fincaIds", etiqueta: "Fincas (no aplica a administradores)", tipo: "multiple", opciones: opcionesFinca, valorInicial: u.fincas.map((f) => f.id).join(",") },
                          ]} />
                        )}
                        {invitaEquipo && u.roles.includes("capataz") && (
                          <FormularioGenerico accion={accionAsignar} boton="Guardar fincas del capataz" ocultos={{ usuarioId: u.id, roles: "capataz" }} campos={[
                            { nombre: "fincaIds", etiqueta: "Fincas que maneja", tipo: "multiple", opciones: opcionesFinca, valorInicial: u.fincas.map((f) => f.id).join(",") },
                          ]} />
                        )}
                        {(administra || invitaEquipo) && !u.pendiente && <FormularioGenerico compacto accion={accionEstadoUsuario} boton={u.activo ? "Desactivar cuenta" : "Reactivar cuenta"} ocultos={{ usuarioId: u.id, activo: u.activo ? "no" : "si" }} campos={[]} />}
                        {administra && (
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-suave">Permiso adicional (avanzado)</summary>
                            <div className="mt-2">
                              <FormularioGenerico compacto accion={accionPermisoExtra} boton="Aplicar" ocultos={{ usuarioId: u.id }} campos={[
                                { nombre: "permiso", etiqueta: "Permiso", tipo: "select", opciones: datos.permisos.map((p) => ({ valor: p.codigo, texto: p.codigo })) },
                                { nombre: "accion", etiqueta: "Acción", tipo: "select", opciones: [{ valor: "otorgar", texto: "Otorgar" }, { valor: "revocar", texto: "Revocar" }] },
                              ]} />
                            </div>
                          </details>
                        )}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="space-y-4">
          {administra && (
            <Tarjeta titulo="Nueva cuenta">
              <p className="-mt-2 mb-3 text-xs text-suave">Para dar de alta una finca nueva con su dueño use <Link href="/fincas" className="font-medium text-bosque underline">Fincas</Link>; aquí puede crear otro administrador o agregar un propietario a fincas existentes.</p>
              <FormularioGenerico accion={accionInvitar} boton="Crear y generar enlace" campos={[
                { nombre: "nombre", etiqueta: "Nombre completo", requerido: true, ancho: "completo" },
                { nombre: "correo", etiqueta: "Correo (será su usuario)", requerido: true, ancho: "completo" },
                { nombre: "roles", etiqueta: "Rol", tipo: "select", opciones: rolesAsignables.map((r) => ({ valor: r.valor, texto: NOMBRE_ROL[r.valor] })), ancho: "completo" },
                ...(opcionesFinca.length > 0 ? [{ nombre: "fincaIds", etiqueta: "Fincas (solo para propietarios)", tipo: "multiple" as const, opciones: opcionesFinca }] : []),
              ]} />
            </Tarjeta>
          )}

          {invitaEquipo && fincas.length === 0 && (
            <Tarjeta titulo="Todavía no tiene fincas">
              <p className="text-sm text-suave">Para crear la cuenta de un capataz o de un trabajador primero necesita una finca asignada. Pídale al administrador de la plataforma que la dé de alta.</p>
            </Tarjeta>
          )}

          {invitaEquipo && fincas.length > 0 && (
            <>
              <Tarjeta titulo="Cuenta de capataz">
                <FormularioGenerico accion={accionInvitar} boton="Crear y generar enlace" ocultos={fincas.length === 1 ? { roles: "capataz", fincaIds: fincas[0].id } : { roles: "capataz" }} campos={[
                  { nombre: "nombre", etiqueta: "Nombre completo", requerido: true, ancho: "completo" },
                  { nombre: "correo", etiqueta: "Correo (será su usuario)", requerido: true, ancho: "completo" },
                  ...(fincas.length > 1 ? [{ nombre: "fincaIds", etiqueta: "Fincas que manejará", tipo: "multiple" as const, opciones: opcionesFinca }] : []),
                ]} />
                {fincas.length === 1 && <p className="mt-3 text-xs text-suave">Manejará la finca {fincas[0].nombre}.</p>}
              </Tarjeta>
              <Tarjeta titulo="Cuenta de trabajador">
                {sinCuenta.length === 0 ? (
                  <p className="text-sm text-suave">Todos sus trabajadores ya tienen cuenta, o aún no ha agregado ninguno. Agréguelos primero en <Link href="/trabajadores" className="font-medium text-bosque underline">Equipo</Link>.</p>
                ) : (
                  <FormularioGenerico accion={accionInvitarTrabajador} boton="Crear y generar enlace" campos={[
                    { nombre: "trabajadorId", etiqueta: "Trabajador", tipo: "select", opciones: sinCuenta.map((w) => ({ valor: w.id, texto: `${w.nombre} · ${w.documento}` })), ancho: "completo" },
                    { nombre: "correo", etiqueta: "Correo (será su usuario)", requerido: true, ancho: "completo", ayuda: "La cuenta queda unida a su ficha: solo verá sus kilos y sus pagos." },
                  ]} />
                )}
              </Tarjeta>
            </>
          )}

          <details className="rounded-xl border border-borde bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold">Qué puede hacer cada rol</summary>
            <ul className="mt-3 space-y-3 text-sm">
              {Object.entries(DESCRIPCION).map(([codigo, texto]) => (
                <li key={codigo}><p className="font-medium">{NOMBRE_ROL[codigo]}</p><p className="text-suave">{texto}</p></li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
