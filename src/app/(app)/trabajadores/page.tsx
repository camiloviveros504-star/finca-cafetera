import Link from "next/link";
import { ErrorProhibido, listarFincasYLotes, listarTrabajadores, listarTrabajos, servicios } from "@/composicion";
import { BotonEliminar } from "../../_componentes/BotonEliminar";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { Tarjeta } from "../../_componentes/Pestanas";
import { cantidad, moneda } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";
import { accionAnticipo, accionCrearTrabajador, accionVincular } from "./acciones";

export const metadata = { title: "Equipo · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const MODALIDAD: Record<string, string> = { kg: "por kilo", arroba: "por arroba", jornada: "por jornal", actividad: "por actividad" };
const LABOR: Record<string, string> = { recoleccion: "Recolección", abonada: "Abonada", fumigacion: "Fumigación", plateo: "Limpieza o paleo", renovacion: "Renovación", otra: "Otra labor" };

export default async function Equipo() {
  const ctx = await exigirContexto();
  let lista;
  try {
    lista = await listarTrabajadores(servicios().talento, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar el equipo.</p>;
    throw error;
  }
  if (!ctx.permisos.has("trabajador:ver")) return <MisKilos ctx={ctx} fila={lista[0]} />;

  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const administra = ctx.permisos.has("trabajador:administrar");
  const variasFincas = fincas.length > 1;
  const opcionesTrabajador = lista.map((w) => ({ valor: w.id, texto: w.nombre }));
  return (
    <div className="space-y-6">
      <EncabezadoModulo titulo="Equipo" detalle="Trabajadores de su finca y lo que han ganado. Los kilos y jornales se anotan en Recolección y en Labores; aquí no se digita nada de eso." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Tarjeta titulo={`Trabajadores (${lista.length})`} className="overflow-hidden !p-0 [&>h2]:mb-0 [&>h2]:border-b [&>h2]:border-borde [&>h2]:px-5 [&>h2]:py-3">
          {lista.length === 0 ? (
            <p className="p-5 text-sm text-suave">Todavía no tiene trabajadores. Agréguelos con el formulario.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {lista.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{w.nombre}</p>
                    <p className="text-xs text-suave">
                      {w.documento}
                      {w.vinculaciones.length > 0 && ` · ${w.vinculaciones.map((v) => `${variasFincas ? `${v.fincaNombre} ` : ""}${MODALIDAD[v.modalidad] ?? v.modalidad}`).join(" · ")}`}
                      {w.usuarioId ? " · tiene cuenta" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-5 text-right text-sm">
                    <div><p className="text-xs text-suave">Ganado</p><p className="font-semibold tabular-nums">{moneda(w.validadoValor)}</p></div>
                    <div><p className="text-xs text-suave">Pagado</p><p className="font-semibold tabular-nums">{moneda(w.pagado)}</p></div>
                    {Number(w.anticiposPendientes) > 0 && <div><p className="text-xs text-suave">Anticipos</p><p className="font-semibold tabular-nums text-ambar">{moneda(w.anticiposPendientes)}</p></div>}
                    <div className="flex items-center gap-1">
                      {ctx.permisos.has("datos_personales:gestionar") && <Link href={`/trabajadores/${w.id}`} className="flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-bosque hover:bg-fondo">Datos</Link>}
                      {administra && <BotonEliminar tipo="trabajador" id={w.id} nombre={w.nombre} />}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="space-y-4">
          {administra && (
            <Tarjeta titulo="Nuevo trabajador">
              <FormularioGenerico
                accion={accionCrearTrabajador}
                boton="Agregar al equipo"
                ocultos={fincas.length === 1 ? { fincaId: fincas[0].id } : {}}
                campos={[
                  { nombre: "nombres", etiqueta: "Nombres", requerido: true },
                  { nombre: "apellidos", etiqueta: "Apellidos", requerido: true },
                  { nombre: "tipoDocumento", etiqueta: "Documento", tipo: "select", opciones: ["CC", "CE", "TI", "PEP", "PPT", "otro"].map((v) => ({ valor: v, texto: v })) },
                  { nombre: "numeroDocumento", etiqueta: "Número", requerido: true },
                  { nombre: "modalidad", etiqueta: "Cómo se le paga", tipo: "select", opciones: [{ valor: "kg", texto: "Por kilo recolectado" }, { valor: "jornada", texto: "Por jornal" }], ancho: "completo" },
                  ...(variasFincas ? [{ nombre: "fincaId", etiqueta: "Finca donde trabaja", tipo: "select" as const, opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })), ancho: "completo" as const }] : []),
                  { nombre: "telefono", etiqueta: "Teléfono (opcional)", ancho: "completo" },
                  { nombre: "autorizaTratamiento", etiqueta: "Autorizó el tratamiento de sus datos (Ley 1581)", tipo: "checkbox", requerido: true },
                ]}
              />
            </Tarjeta>
          )}
          {ctx.permisos.has("anticipo:registrar") && lista.length > 0 && (
            <details className="rounded-xl border border-borde bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold">Dar un anticipo</summary>
              <div className="mt-3">
                <FormularioGenerico accion={accionAnticipo} boton="Registrar anticipo" conClave campos={[
                  { nombre: "trabajadorId", etiqueta: "Trabajador", tipo: "select", opciones: opcionesTrabajador, ancho: "completo" },
                  { nombre: "monto", etiqueta: "Valor (COP)", tipo: "number", requerido: true },
                  { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
                  { nombre: "nota", etiqueta: "Nota (opcional)", ancho: "completo" },
                ]} />
              </div>
            </details>
          )}
          {administra && variasFincas && lista.length > 0 && (
            <details className="rounded-xl border border-borde bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold">Vincular a otra finca</summary>
              <div className="mt-3">
                <FormularioGenerico accion={accionVincular} boton="Vincular" campos={[
                  { nombre: "trabajadorId", etiqueta: "Trabajador", tipo: "select", opciones: opcionesTrabajador, ancho: "completo" },
                  { nombre: "fincaId", etiqueta: "Finca", tipo: "select", opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })), ancho: "completo" },
                  { nombre: "modalidad", etiqueta: "Cómo se le paga", tipo: "select", opciones: [{ valor: "kg", texto: "Por kilo" }, { valor: "jornada", texto: "Por jornal" }] },
                  { nombre: "desde", etiqueta: "Desde", tipo: "date", requerido: true, valorInicial: hoy() },
                ]} />
              </div>
            </details>
          )}
          <p className="px-1 text-xs text-suave">Este sistema registra lo que se paga por kilo o por jornal. No es software de nómina: no calcula prestaciones, seguridad social ni retenciones.</p>
        </div>
      </div>
    </div>
  );
}

/** Vista del trabajador: sus kilos, sus jornales y lo que le han pagado. Nada de los demás. */
async function MisKilos({ ctx, fila }: { ctx: Awaited<ReturnType<typeof exigirContexto>>; fila?: Awaited<ReturnType<typeof listarTrabajadores>>[number] }) {
  const registros = await listarTrabajos(servicios().talento, ctx).catch(() => []);
  const mes = hoy().slice(0, 7);
  const delMes = registros.filter((r) => r.fecha.startsWith(mes) && r.estado !== "rechazado");
  const kgMes = delMes.filter((r) => r.modalidad !== "jornada").reduce((t, r) => t + Number(r.cantidadValidada ?? r.cantidadDeclarada), 0);
  const jornalesMes = delMes.filter((r) => r.modalidad === "jornada").reduce((t, r) => t + Number(r.cantidadValidada ?? r.cantidadDeclarada), 0);
  return (
    <div className="space-y-6">
      <EncabezadoModulo titulo="Mis kilos y pagos" detalle="Lo que le han registrado y lo que le han pagado. Si algo no cuadra, hable con el capataz o el dueño de la finca." />
      {!fila ? (
        <p className="rounded-xl border border-dashed border-borde bg-white p-5 text-sm text-suave">Su cuenta todavía no está vinculada a su ficha de trabajador. Pídale al dueño de la finca que la vincule.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[["Kilos este mes", `${cantidad(kgMes)} kg`], ["Jornales este mes", cantidad(jornalesMes)], ["Ganado en total", moneda(fila.validadoValor)], ["Pagado en total", moneda(fila.pagado)]].map(([t, v]) => (
            <li key={t} className="rounded-xl border border-borde bg-white p-4 shadow-sm"><p className="text-xs font-medium text-suave sm:text-sm">{t}</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{v}</p></li>
          ))}
        </ul>
      )}
      <Tarjeta titulo="Mis registros" className="overflow-hidden !p-0 [&>h2]:mb-0 [&>h2]:border-b [&>h2]:border-borde [&>h2]:px-5 [&>h2]:py-3">
        {registros.length === 0 ? <p className="p-5 text-sm text-suave">Todavía no tiene registros.</p> : (
          <ul className="divide-y divide-borde">
            {registros.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{LABOR[r.labor ?? "recoleccion"] ?? r.labor}{r.loteCodigo ? ` · lote ${r.loteCodigo}` : ""}</p>
                  <p className="text-xs text-suave">{r.fecha} · {cantidad(r.cantidadValidada ?? r.cantidadDeclarada)} {r.modalidad === "jornada" ? "jornal(es)" : "kg"}{r.estado === "rechazado" ? " · rechazado" : r.estado === "liquidado" ? " · liquidado" : ""}</p>
                </div>
                {r.valor !== null && <span className="shrink-0 text-sm font-semibold tabular-nums">{moneda(r.valor)}</span>}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
