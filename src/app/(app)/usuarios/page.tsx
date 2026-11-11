import { ErrorProhibido, listarFincasYLotes, listarUsuarios, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { exigirContexto } from "../../_servidor/sesion";
import { accionAsignar, accionContrasena, accionCrearUsuario, accionEstadoUsuario, accionPermisoExtra } from "./acciones";

export const metadata = { title: "Usuarios y permisos · Gestión de Finca Cafetera" };

export default async function Usuarios() {
  const ctx = await exigirContexto();
  let datos;
  try {
    datos = await listarUsuarios(servicios().usuarios, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar usuarios.</p>;
    throw error;
  }
  const administra = ctx.permisos.has("usuario:administrar");
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const opcionesRol = datos.roles.map((r) => ({ valor: r.codigo, texto: `${r.nombre}${r.esExtension ? " (extensión)" : ""}` }));
  const opcionesFinca = fincas.map((f) => ({ valor: f.id, texto: f.nombre }));
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Usuarios, roles y permisos" detalle="Los permisos se comprueban en el servidor; ocultar un botón es solo una ayuda visual." />
      {administra && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo usuario</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionCrearUsuario} boton="Crear usuario" campos={[
              { nombre: "correo", etiqueta: "Correo", requerido: true }, { nombre: "nombre", etiqueta: "Nombre", requerido: true },
              { nombre: "contrasena", etiqueta: "Contraseña (mínimo 10, letras y números)", tipo: "password", requerido: true },
              { nombre: "roles", etiqueta: "Roles", tipo: "multiple", opciones: opcionesRol },
              { nombre: "fincaIds", etiqueta: "Fincas con acceso", tipo: "multiple", opciones: opcionesFinca },
              { nombre: "autoriza", etiqueta: "La persona autorizó el tratamiento de sus datos personales (Ley 1581)", tipo: "checkbox", requerido: true },
            ]} />
          </div>
        </details>
      )}
      <ul className="space-y-3">
        {datos.usuarios.map((u) => (
          <li key={u.id} className={`rounded-xl border-2 bg-white p-3 text-sm ${u.activo ? "border-cafe/20" : "border-cereza opacity-80"}`}>
            <p className="text-base font-extrabold">{u.nombre} <span className="font-normal">· {u.correo}{u.activo ? "" : " · DESACTIVADO"}</span></p>
            <p>Roles: {u.roles.join(", ").replaceAll("_", " ") || "—"} · Fincas: {u.fincas.map((f) => f.nombre).join(", ") || "—"}</p>
            {u.permisosExtra.length > 0 && <p>Permisos adicionales: {u.permisosExtra.join(", ")}</p>}
            {administra && (
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer font-semibold">Administrar</summary>
                <div className="mt-2 space-y-3">
                  <FormularioGenerico accion={accionAsignar} boton="Guardar roles y fincas" ocultos={{ usuarioId: u.id }} campos={[
                    { nombre: "roles", etiqueta: "Roles", tipo: "multiple", opciones: opcionesRol, valorInicial: u.roles.join(",") },
                    { nombre: "fincaIds", etiqueta: "Fincas", tipo: "multiple", opciones: opcionesFinca, valorInicial: u.fincas.map((f) => f.id).join(",") },
                  ]} />
                  <div className="flex flex-wrap gap-2">
                    <FormularioGenerico compacto accion={accionEstadoUsuario} boton={u.activo ? "Desactivar" : "Reactivar"} ocultos={{ usuarioId: u.id, activo: u.activo ? "no" : "si" }} campos={[]} />
                    <FormularioGenerico compacto accion={accionContrasena} boton="Restablecer contraseña" ocultos={{ usuarioId: u.id }} campos={[{ nombre: "contrasena", etiqueta: "Nueva contraseña", tipo: "password", requerido: true }]} />
                  </div>
                  <FormularioGenerico compacto accion={accionPermisoExtra} boton="Aplicar" ocultos={{ usuarioId: u.id }} campos={[
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
          <li key={r.codigo} className="rounded-xl border-2 border-cafe/20 bg-white p-3 text-sm">
            <p className="font-bold">{r.nombre}{r.esExtension ? " · extensión" : ""}</p>
            <p className="opacity-80">{r.permisos.join(" · ")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
