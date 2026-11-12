import { ErrorProhibido, listarFincasYLotes, listarUsuarios, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { Tarjeta } from "../../_componentes/Pestanas";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionEmitirEnlace } from "../usuarios/acciones";
import { accionAgregarPropietario, accionAltaFinca, accionAsignarFinca } from "./acciones";

export const metadata = { title: "Fincas · Gestión de Finca Cafetera" };

const ESTADO_LOTE: Record<string, string> = { sin_sembrar: "Sin sembrar", levante: "Levante", produccion: "Producción", zoca: "Zoca", renovacion: "Renovación", inactivo: "Inactivo" };

type Finca = { id: string; nombre: string; ubicacion: string | null; areaHa: string | null; lotes: number };
type Lote = { id: string; fincaId: string; codigo: string; nombre: string; areaHa: string | null; estadoProductivo: string; cosechadoKg: string };

function TarjetaFinca({ f, lotes }: { f: Finca; lotes: Lote[] }) {
  return (
    <div className="rounded-lg border border-borde bg-fondo/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{f.nombre}</p>
        <p className="text-xs text-suave">{f.ubicacion ?? "Sin ubicación"} · {f.areaHa ? `${cantidad(f.areaHa)} ha` : "área sin registrar"}</p>
      </div>
      {lotes.length === 0 ? (
        <p className="mt-2 text-xs text-suave">Sin lotes todavía: los registra el propietario.</p>
      ) : (
        <ul className="mt-2 divide-y divide-borde rounded-md border border-borde bg-white text-sm">
          {lotes.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span><span className="font-medium">{l.codigo}</span> · {l.nombre}{l.areaHa ? ` · ${cantidad(l.areaHa)} ha` : ""}</span>
              <span className="text-xs text-suave">{ESTADO_LOTE[l.estadoProductivo] ?? l.estadoProductivo} · {cantidad(l.cosechadoKg)} kg</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const propietarios = cuentas.usuarios.filter((u) => u.roles.includes("propietario"));
  const conDueno = new Set(propietarios.flatMap((p) => p.fincas.map((f) => f.id)));
  const sinDueno = datos.fincas.filter((f) => !conDueno.has(f.id));
  const lotesDe = (fincaId: string) => datos.lotes.filter((l) => l.fincaId === fincaId);
  const fincaPorId = new Map(datos.fincas.map((f) => [f.id, f]));
  const totalHa = datos.fincas.reduce((s, f) => s + Number(f.areaHa ?? 0), 0);
  const opcionesPropietario = propietarios.map((p) => ({ valor: p.id, texto: `${p.nombre} · ${p.correo}` }));

  return (
    <div className="space-y-6">
      <EncabezadoModulo
        titulo="Fincas y propietarios"
        detalle={`${propietarios.length} propietario(s) · ${datos.fincas.length} finca(s) · ${datos.lotes.length} lote(s) · ${cantidad(totalHa)} ha. Cada propietario puede tener varias fincas y cada finca sus lotes; los lotes los registra el propietario.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {propietarios.length === 0 && sinDueno.length === 0 && (
            <p className="rounded-xl border border-dashed border-borde bg-white p-6 text-center text-sm text-suave">Todavía no hay fincas. Dé de alta la primera con el formulario.</p>
          )}

          {propietarios.map((p) => {
            const fincas = p.fincas.map((f) => fincaPorId.get(f.id)).filter((f): f is Finca => Boolean(f));
            return (
              <section key={p.id} className="rounded-xl border border-borde bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{p.nombre}</p>
                    <p className="text-xs text-suave">{p.correo} · {p.pendiente ? "pendiente de activar" : p.activo ? "cuenta activa" : "cuenta desactivada"}</p>
                  </div>
                  <dl className="flex gap-5 text-right text-sm">
                    <div><dt className="text-xs text-suave">Fincas</dt><dd className="font-semibold tabular-nums">{fincas.length}</dd></div>
                    <div><dt className="text-xs text-suave">Capataces</dt><dd className="font-semibold tabular-nums">{p.equipo?.capataces ?? 0}</dd></div>
                    <div><dt className="text-xs text-suave">Trabajadores</dt><dd className="font-semibold tabular-nums">{p.equipo?.trabajadores ?? 0}</dd></div>
                  </dl>
                </div>
                <div className="mt-4 space-y-3">
                  {fincas.length === 0 ? <p className="text-sm text-suave">Este propietario no tiene fincas asignadas.</p> : fincas.map((f) => <TarjetaFinca key={f.id} f={f} lotes={lotesDe(f.id)} />)}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6">
                  <details className="min-w-0 flex-1">
                    <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-bosque">Agregar otra finca a {p.nombre.split(" ")[0]}</summary>
                    <div className="mt-2">
                      <FormularioGenerico accion={accionAltaFinca} boton="Crear finca" ocultos={{ propietarioId: p.id }} campos={[
                        { nombre: "nombre", etiqueta: "Nombre de la finca", requerido: true, ancho: "completo" },
                        { nombre: "ubicacion", etiqueta: "Ubicación" },
                        { nombre: "areaHa", etiqueta: "Área (ha)", tipo: "number" },
                      ]} />
                    </div>
                  </details>
                  {p.pendiente && (
                    <details>
                      <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-ambar">{p.invitacionVigente ? "Enlace de activación" : "El enlace venció"}</summary>
                      <div className="mt-2"><FormularioGenerico compacto accion={accionEmitirEnlace} boton="Generar enlace nuevo" ocultos={{ usuarioId: p.id }} campos={[]} /></div>
                    </details>
                  )}
                </div>
              </section>
            );
          })}

          {sinDueno.length > 0 && (
            <section className="rounded-xl border border-ambar/40 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Fincas sin propietario ({sinDueno.length})</h2>
              <div className="mt-3 space-y-4">
                {sinDueno.map((f) => (
                  <div key={f.id} className="space-y-2">
                    <TarjetaFinca f={f} lotes={lotesDe(f.id)} />
                    <div className="flex flex-wrap gap-x-6">
                      {opcionesPropietario.length > 0 && (
                        <details>
                          <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-bosque">Asignar a un propietario existente</summary>
                          <FormularioGenerico compacto accion={accionAsignarFinca} boton="Asignar" ocultos={{ fincaId: f.id }} campos={[{ nombre: "propietarioId", etiqueta: "Propietario", tipo: "select", opciones: opcionesPropietario }]} />
                        </details>
                      )}
                      <details>
                        <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-bosque">Registrar un propietario nuevo</summary>
                        <FormularioGenerico accion={accionAgregarPropietario} boton="Registrar propietario" ocultos={{ fincaId: f.id }} campos={[
                          { nombre: "nombre", etiqueta: "Nombre completo", requerido: true },
                          { nombre: "correo", etiqueta: "Correo (será su usuario)", requerido: true },
                        ]} />
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <Tarjeta titulo="Nueva finca" className="h-fit">
          <ol className="-mt-2 mb-4 list-decimal space-y-0.5 pl-5 text-xs text-suave">
            <li>Escriba los datos de la finca.</li>
            <li>Elija su propietario, o marque “Es un propietario nuevo” y escriba su nombre y correo.</li>
            <li>Al propietario nuevo entréguele el enlace: crea su contraseña y registra los lotes.</li>
          </ol>
          <FormularioGenerico accion={accionAltaFinca} boton="Crear finca" campos={[
            { nombre: "nombre", etiqueta: "Nombre de la finca", requerido: true, ancho: "completo" },
            { nombre: "ubicacion", etiqueta: "Ubicación (vereda, municipio)", ancho: "completo" },
            { nombre: "areaHa", etiqueta: "Área total (ha)", tipo: "number", ancho: "completo" },
            ...(opcionesPropietario.length > 0 ? [{ nombre: "propietarioId", etiqueta: "Propietario", tipo: "select" as const, ancho: "completo" as const, opciones: [{ valor: "", texto: "Elija el propietario…" }, ...opcionesPropietario] }] : []),
            { nombre: "propietarioNuevo", etiqueta: "Es un propietario nuevo", tipo: "checkbox" },
            { nombre: "propietarioNombre", etiqueta: "Nombre del propietario", visibleSi: "propietarioNuevo", ancho: "completo" },
            { nombre: "propietarioCorreo", etiqueta: "Correo del propietario (será su usuario)", visibleSi: "propietarioNuevo", ancho: "completo" },
          ]} />
        </Tarjeta>
      </div>
    </div>
  );
}
