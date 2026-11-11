import { ErrorProhibido, listarFincasYLotes, listarTrabajadores, listarUsuarios, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { exigirContexto } from "../../_servidor/sesion";
import { accionAsignar, accionEmitirEnlace, accionEstadoUsuario, accionInvitar, accionPermisoExtra } from "./acciones";

export const metadata = { title: "Usuarios y permisos · Gestión de Finca Cafetera" };

function Estado({ activo, pendiente }: { activo: boolean; pendiente: boolean }) {
  const [texto, clase] = pendiente ? ["Pendiente de activación", "bg-ambar/25 text-tinta"] : activo ? ["Activo", "bg-bosque/15 text-bosque"] : ["Desactivado", "bg-alerta/10 text-alerta"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${clase}`}>{texto}</span>;
}

export default async function Usuarios() {
  const ctx = await exigirContexto();
  let datos;
  try {
    datos = await listarUsuarios(servicios().usuarios, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar usuarios.</p>;
    throw error;
  }
  const administra = ctx.permisos.has("usuario:administrar");
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const sinCuenta = administra ? (await listarTrabajadores(servicios().talento, ctx).catch(() => [])).filter((w) => !w.usuarioId) : [];
  const opcionesRol = datos.roles.map((r) => ({ valor: r.codigo, texto: `${r.nombre}${r.esExtension ? " (extensión)" : ""}` }));
  const opcionesFinca = fincas.map((f) => ({ valor: f.id, texto: f.nombre }));
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Usuarios, roles y permisos" detalle="El administrador crea las cuentas y define los roles. Cada persona fija su propia contraseña." />

      {administra && (
        <div className="rounded-xl border border-tinta/15 bg-white p-5">
          <h2 className="text-lg font-extrabold">Registrar un usuario</h2>
          <ol className="mb-4 mt-2 list-decimal space-y-0.5 pl-5 text-sm text-tinta/80">
            <li>Escriba su nombre y correo, y elija sus roles y las fincas a las que tendrá acceso.</li>
            <li>El sistema genera un enlace de un solo uso (vence en 72 horas). Entréguelo a la persona.</li>
            <li>Ella crea su contraseña con ese enlace. Usted nunca la conoce.</li>
          </ol>
          <FormularioGenerico
            accion={accionInvitar}
            boton="Registrar y generar enlace"
            campos={[
              { nombre: "nombre", etiqueta: "Nombre completo", requerido: true },
              { nombre: "correo", etiqueta: "Correo (será su usuario)", requerido: true },
              { nombre: "roles", etiqueta: "Roles", tipo: "multiple", opciones: opcionesRol },
              { nombre: "fincaIds", etiqueta: "Fincas con acceso", tipo: "multiple", opciones: opcionesFinca },
              { nombre: "trabajadorId", etiqueta: "Vincular con un trabajador (para recolectores y supervisores)", tipo: "select", opciones: [{ valor: "", texto: "No vincular" }, ...sinCuenta.map((w) => ({ valor: w.id, texto: `${w.nombre} · ${w.documento}` }))] },
            ]}
          />
        </div>
      )}

      <ul className="space-y-3">
        {datos.usuarios.map((u) => (
          <li key={u.id} className="rounded-xl border border-tinta/15 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-extrabold">{u.nombre} <span className="font-normal text-tinta/70">· {u.correo}</span></p>
              <Estado activo={u.activo} pendiente={u.pendiente} />
            </div>
            <p className="mt-1">Roles: {u.roles.join(", ").replaceAll("_", " ") || "—"} · Fincas: {u.fincas.map((f) => f.nombre).join(", ") || "—"}</p>
            {u.permisosExtra.length > 0 && <p>Permisos adicionales: {u.permisosExtra.join(", ")}</p>}
            {u.pendiente && !u.invitacionVigente && <p className="mt-1 font-semibold text-alerta">El enlace venció: genere uno nuevo.</p>}
            {administra && (
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer font-semibold">Administrar</summary>
                <div className="mt-2 space-y-4">
                  <div>
                    <p className="mb-1 font-semibold">{u.pendiente ? "Enlace de activación" : "Restablecer contraseña"}</p>
                    <FormularioGenerico compacto accion={accionEmitirEnlace} boton={u.pendiente ? "Generar enlace nuevo" : "Generar enlace de restablecimiento"} ocultos={{ usuarioId: u.id }} campos={[]} />
                  </div>
                  <FormularioGenerico accion={accionAsignar} boton="Guardar roles y fincas" ocultos={{ usuarioId: u.id }} campos={[
                    { nombre: "roles", etiqueta: "Roles", tipo: "multiple", opciones: opcionesRol, valorInicial: u.roles.join(",") },
                    { nombre: "fincaIds", etiqueta: "Fincas", tipo: "multiple", opciones: opcionesFinca, valorInicial: u.fincas.map((f) => f.id).join(",") },
                  ]} />
                  {!u.pendiente && <FormularioGenerico compacto accion={accionEstadoUsuario} boton={u.activo ? "Desactivar cuenta" : "Reactivar cuenta"} ocultos={{ usuarioId: u.id, activo: u.activo ? "no" : "si" }} campos={[]} />}
                  <FormularioGenerico compacto accion={accionPermisoExtra} boton="Aplicar permiso" ocultos={{ usuarioId: u.id }} campos={[
                    { nombre: "permiso", etiqueta: "Permiso adicional", tipo: "select", opciones: datos.permisos.map((p) => ({ valor: p.codigo, texto: p.codigo })) },
                    { nombre: "accion", etiqueta: "Acción", tipo: "select", opciones: [{ valor: "otorgar", texto: "Otorgar" }, { valor: "revocar", texto: "Revocar" }] },
                  ]} />
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-extrabold">Roles y sus permisos</h2>
      <ul className="grid gap-2 lg:grid-cols-2">
        {datos.roles.map((r) => (
          <li key={r.codigo} className="rounded-xl border border-tinta/15 bg-white p-3 text-sm">
            <p className="font-bold">{r.nombre}{r.esExtension ? " · extensión" : ""}</p>
            <p className="opacity-80">{r.permisos.join(" · ")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
