import { ErrorProhibido, listarFincasYLotes, listarUsuarios, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { exigirContexto } from "../../_servidor/sesion";
import { accionEmitirEnlace } from "../usuarios/acciones";
import { accionAgregarPropietario, accionAltaFinca } from "./acciones";

export const metadata = { title: "Fincas · Gestión de Finca Cafetera" };

export default async function Fincas() {
  const ctx = await exigirContexto();
  if (!ctx.permisos.has("finca:administrar")) return <p role="alert" className="font-semibold text-alerta">Esta sección es del administrador de la plataforma. Las fincas y lotes de su finca están en “Lotes”.</p>;
  let datos, cuentas;
  try {
    datos = await listarFincasYLotes(servicios().fincasLotes, ctx);
    cuentas = await listarUsuarios(servicios().usuarios, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar fincas.</p>;
    throw error;
  }
  const propietariosDe = (fincaId: string) => cuentas.usuarios.filter((u) => u.roles.includes("propietario") && u.fincas.some((f) => f.id === fincaId));
  const totalHa = datos.fincas.reduce((s, f) => s + Number(f.areaHa ?? 0), 0);
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Fincas de la plataforma" detalle={`${datos.fincas.length} finca(s) · ${totalHa.toLocaleString("es-CO")} ha. Usted da de alta la finca y a su propietario; cada propietario administra lo suyo: lotes, insumos, equipo, recolección y ventas.`} />

      <div className="rounded-xl border border-borde shadow-sm bg-white p-5">
        <h2 className="text-base font-semibold">Dar de alta una finca</h2>
        <ol className="mb-4 mt-2 list-decimal space-y-0.5 pl-5 text-sm text-tinta/80">
          <li>Escriba los datos de la finca y de su propietario (nombre y correo).</li>
          <li>El sistema crea la finca con su bodega y la cuenta del propietario, ya asignada a esa finca.</li>
          <li>Le entrega el enlace de un solo uso: él crea su contraseña y empieza a registrar sus lotes.</li>
        </ol>
        <FormularioGenerico
          accion={accionAltaFinca}
          boton="Crear finca y propietario"
          campos={[
            { nombre: "nombre", etiqueta: "Nombre de la finca", requerido: true },
            { nombre: "ubicacion", etiqueta: "Ubicación (vereda, municipio)" },
            { nombre: "areaHa", etiqueta: "Área total (hectáreas)", tipo: "number" },
            { nombre: "propietarioNombre", etiqueta: "Nombre del propietario" },
            { nombre: "propietarioCorreo", etiqueta: "Correo del propietario (será su usuario)" },
          ]}
        />
        <p className="mt-2 text-xs text-tinta/70">Si deja vacíos los datos del propietario, la finca se crea sin dueño y lo agrega después.</p>
      </div>

      {datos.fincas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borde p-6 text-center">Todavía no hay fincas.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {datos.fincas.map((f) => {
            const duenos = propietariosDe(f.id);
            return (
              <li key={f.id} className="rounded-xl border border-borde shadow-sm bg-white p-4">
                <p className="text-base font-semibold">{f.nombre}</p>
                <p className="text-sm">{f.ubicacion ?? "Sin ubicación"} · {f.areaHa ?? "—"} ha · {f.lotes} lote(s)</p>
                <div className="mt-3">
                  <p className="text-sm font-bold">Propietario(s)</p>
                  {duenos.length === 0 ? (
                    <p className="text-sm font-semibold text-alerta">Sin propietario: agréguelo abajo.</p>
                  ) : (
                    <ul className="mt-1 space-y-2 text-sm">
                      {duenos.map((u) => (
                        <li key={u.id}>
                          {u.nombre} · {u.correo} · <span className="font-semibold">{u.pendiente ? "pendiente de activar" : u.activo ? "activo" : "desactivado"}</span>
                          {u.pendiente && (
                            <details className="mt-1">
                              <summary className="min-h-11 cursor-pointer py-2 font-semibold text-bosque">{u.invitacionVigente ? "Volver a ver el acceso" : "El enlace venció: generar uno nuevo"}</summary>
                              <FormularioGenerico compacto accion={accionEmitirEnlace} boton="Generar enlace nuevo" ocultos={{ usuarioId: u.id }} campos={[]} />
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-bosque">Agregar propietario</summary>
                  <FormularioGenerico
                    accion={accionAgregarPropietario}
                    boton="Registrar propietario"
                    ocultos={{ fincaId: f.id }}
                    campos={[{ nombre: "nombre", etiqueta: "Nombre completo", requerido: true }, { nombre: "correo", etiqueta: "Correo (será su usuario)", requerido: true }]}
                  />
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
