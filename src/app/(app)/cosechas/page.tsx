import Link from "next/link";
import { consultarCultivo, ErrorProhibido, listarCosechas, listarTrabajadores, obtenerOpcionesRegistro, servicios } from "@/composicion";
import { FormularioGenerico } from "../../_componentes/FormularioGenerico";
import { cantidad } from "../../_servidor/formatos";
import { accionAnularCosecha, accionRegistrarRecoleccion } from "./acciones";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Recolección · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export default async function Cosechas({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const ctx = await exigirContexto();
  const pagina = Math.max(Number((await searchParams).pagina ?? 1) || 1, 1);
  let datos;
  try {
    datos = await listarCosechas(servicios().produccion, ctx, pagina);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar cosechas.</p>;
    throw error;
  }
  const paginas = Math.max(Math.ceil(datos.total / 25), 1);
  const puedePagar = ctx.permisos.has("cosecha:registrar") && ctx.permisos.has("trabajo:registrar");
  const opciones = ctx.permisos.has("cosecha:registrar") ? await obtenerOpcionesRegistro(servicios().produccion, ctx).catch(() => null) : null;
  const trabajadores = puedePagar ? await listarTrabajadores(servicios().talento, ctx).catch(() => []) : [];
  const lotesCultivo = await consultarCultivo(servicios().cultivo, ctx).catch(() => []);
  const sembrados = lotesCultivo.filter((l) => l.origen !== "sin_sembrar");
  const tiposCafe = (opciones?.productos ?? []).map((p) => ({ valor: p.id, texto: p.nombre }));
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Recolección</h1>
        {ctx.permisos.has("cosecha:registrar") && (
          <Link href="/cosechas/nueva" className="flex min-h-11 items-center rounded-lg border border-bosque px-4 font-bold text-bosque">
            Registro rápido sin conexión
          </Link>
        )}
      </div>

      {sembrados.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 text-base font-semibold">Café recolectado por lote</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {sembrados.map((l) => (
              <li key={l.id} className="rounded-xl border border-borde shadow-sm bg-white p-3 text-sm">
                <p className="font-bold">{l.codigo} · {l.nombre}</p>
                <p>{l.origen === "zoca" ? "Zoca" : "Café nuevo"} · {l.fincaNombre}</p>
                <p className="text-base font-semibold">{cantidad(l.cosechadoKg)} kg</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {puedePagar && opciones && (
        <details open className="mb-6 rounded-xl border border-borde shadow-sm bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-base font-semibold">Registrar recolección del día</summary>
          <p className="my-2 text-sm">Elija el lote y el tipo de café, y anote cuántos kilos recogió cada trabajador y a cuánto se le paga el kilo. El café entra a la bodega y lo que se le debe a cada uno queda listo para liquidar.</p>
          <FormularioGenerico accion={accionRegistrarRecoleccion} boton="Registrar recolección" conClave columnas={3} campos={[
            { nombre: "loteId", etiqueta: "Lote", tipo: "select", requerido: true, opciones: (sembrados.length > 0 ? sembrados : lotesCultivo).map((l) => ({ valor: l.id, texto: `${l.fincaNombre} · ${l.codigo} ${l.nombre}` })) },
            { nombre: "productoId", etiqueta: "Tipo de café recogido", tipo: "select", requerido: true, opciones: tiposCafe },
            { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true, valorInicial: hoy() },
            { nombre: "kgTotal", etiqueta: "Kilos totales", tipo: "number", ayuda: "Si lo deja vacío se suman los kilos de los trabajadores." },
            ...[1, 2, 3, 4, 5, 6].flatMap((n) => {
              const visibleSi = n > 3 ? "masTrabajadores" : undefined;
              return [
                { nombre: `trabajadorId${n}`, etiqueta: `Trabajador ${n}`, tipo: "select" as const, visibleSi, seccion: n === 1 ? "Kilos por trabajador" : undefined, opciones: [{ valor: "", texto: n === 1 ? "Elija un trabajador…" : "— ninguno —" }, ...trabajadores.map((w) => ({ valor: w.id, texto: w.nombre }))] },
                { nombre: `kg${n}`, etiqueta: "Kilos", tipo: "number" as const, visibleSi },
                { nombre: `precio${n}`, etiqueta: "Valor del kilo (COP)", tipo: "number" as const, visibleSi },
              ];
            }).flatMap((c, i) => (i === 9 ? [{ nombre: "masTrabajadores", etiqueta: "Más de tres trabajadores", tipo: "checkbox" as const }, c] : [c])),
            { nombre: "conFlete", etiqueta: "Hubo flete para llevar este café", tipo: "checkbox" },
            { nombre: "flete", etiqueta: "Valor del flete (COP)", tipo: "number", visibleSi: "conFlete", ayuda: "Sale de su billetera como gasto de este lote." },
            { nombre: "destinoFlete", etiqueta: "Hacia dónde", placeholder: "Beneficiadero, bodega, cooperativa…", visibleSi: "conFlete" },
            { nombre: "conNota", etiqueta: "Agregar una nota", tipo: "checkbox" },
            { nombre: "nota", etiqueta: "Nota", tipo: "textarea", visibleSi: "conNota" },
          ]} />
        </details>
      )}

      {datos.filas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-borde bg-white p-5 text-sm text-suave">Todavía no hay cosechas registradas.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {datos.filas.map((c) => (
            <li key={c.id} className="rounded-xl border border-borde shadow-sm bg-white p-3">
              <p className="font-bold">{c.productoNombre}{c.estado === "anulada" ? " · ANULADA" : ""}</p>
              <p className="text-sm">Lote {c.loteCodigo} · {c.fecha}</p>
              <p className={`mt-1 text-base font-semibold ${c.estado === "anulada" ? "line-through opacity-60" : ""}`}>{cantidad(c.cantidad)} {c.unidadCodigo}</p>
              {ctx.permisos.has("cosecha:anular") && c.estado === "confirmada" && (
                <details className="mt-2"><summary className="min-h-11 cursor-pointer font-semibold text-alerta">Anular</summary>
                  <FormularioGenerico compacto accion={accionAnularCosecha} boton="Confirmar anulación" ocultos={{ cosechaId: c.id }} campos={[{ nombre: "motivo", etiqueta: "Motivo (mínimo 10 caracteres)", requerido: true }]} />
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      {paginas > 1 && (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
          {pagina > 1 ? <Link className="min-h-11 py-3 font-bold underline" href={`/cosechas?pagina=${pagina - 1}`}>← Anterior</Link> : <span />}
          <span>Página {pagina} de {paginas}</span>
          {pagina < paginas ? <Link className="min-h-11 py-3 font-bold underline" href={`/cosechas?pagina=${pagina + 1}`}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </section>
  );
}
