import Link from "next/link";
import { ErrorProhibido, listarFincasYLotes, obtenerAjustes, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../../_componentes/FormularioGenerico";
import { exigirContexto } from "../../../_servidor/sesion";
import { accionEquivalencia, accionEstadoValor, accionParametro, accionTemporada, accionValorCatalogo } from "../../usuarios/acciones";

export const metadata = { title: "Configuración general · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const NOMBRE_CATALOGO: Record<string, string> = { metodo_pago: "Métodos de pago", tipo_gasto: "Tipos de gasto", tipo_cafe: "Tipos de café", categoria_producto: "Categorías de producto", estado_operativo: "Estados operativos" };

export default async function ConfiguracionGeneral() {
  const ctx = await exigirContexto();
  let a;
  try {
    a = await obtenerAjustes(servicios().ajustes, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-cereza">No tiene permiso para consultar la configuración.</p>;
    throw error;
  }
  const modifica = ctx.permisos.has("configuracion:modificar");
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const porCatalogo = Object.groupBy(a.catalogos, (c) => c.catalogo);
  return (
    <section className="space-y-6">
      <EncabezadoModulo titulo="Configuración general" detalle="Unidades, equivalencias, catálogos, temporadas y parámetros. Los valores de demostración están marcados DEMO." />
      <p className="text-sm"><Link className="font-semibold underline" href="/configuracion">Ir a tarifas y precios</Link></p>

      <h2 className="text-xl font-extrabold">Equivalencias de unidades</h2>
      <p className="text-sm">Cada cambio crea una vigencia nueva y cierra la anterior; lo ya registrado conserva el factor que se aplicó.</p>
      {modifica && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nueva equivalencia</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionEquivalencia} boton="Crear equivalencia" campos={[
              { nombre: "origen", etiqueta: "Unidad de origen", tipo: "select", opciones: ["arroba", "carga", "saco", "kg"].map((v) => ({ valor: v, texto: v })) },
              { nombre: "destino", etiqueta: "Unidad de destino", tipo: "select", opciones: ["kg", "arroba", "carga", "saco"].map((v) => ({ valor: v, texto: v })) },
              { nombre: "factor", etiqueta: "Factor", tipo: "number", requerido: true },
              { nombre: "fincaId", etiqueta: "Ámbito", tipo: "select", opciones: [{ valor: "", texto: "General" }, ...fincas.map((f) => ({ valor: f.id, texto: f.nombre }))] },
              { nombre: "desde", etiqueta: "Vigente desde", tipo: "date", requerido: true, valorInicial: hoy() },
            ]} />
          </div>
        </details>
      )}
      <ul className="grid gap-2 md:grid-cols-2">
        {a.equivalencias.map((e) => (
          <li key={e.id} className={`rounded-xl border-2 bg-white p-3 text-sm ${e.vigente ? "border-cafetal" : "border-cafe/20 opacity-80"}`}>
            <strong>1 {e.origen} = {Number(e.factor)} {e.destino}</strong>{e.esDemo ? " · DEMO" : ""} · {e.fincaNombre ?? "General"}<br />
            Desde {e.desde}{e.hasta ? ` hasta ${e.hasta}` : " (sin fin)"}{e.vigente ? " · vigente hoy" : ""}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-extrabold">Catálogos</h2>
      {modifica && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nuevo valor de catálogo</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionValorCatalogo} boton="Crear valor" campos={[
              { nombre: "catalogo", etiqueta: "Catálogo", tipo: "select", opciones: Object.entries(NOMBRE_CATALOGO).map(([valor, texto]) => ({ valor, texto })) },
              { nombre: "codigo", etiqueta: "Código", requerido: true, placeholder: "transferencia" }, { nombre: "nombre", etiqueta: "Nombre visible", requerido: true },
            ]} />
          </div>
        </details>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(NOMBRE_CATALOGO).map(([clave, titulo]) => (
          <div key={clave} className="rounded-xl border-2 border-cafe/20 bg-white p-3 text-sm">
            <p className="font-bold">{titulo}</p>
            <ul>
              {(porCatalogo[clave] ?? []).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                  <span className={v.activo ? "" : "line-through opacity-60"}>{v.nombre} <span className="opacity-60">({v.codigo})</span></span>
                  {modifica && <FormularioGenerico compacto accion={accionEstadoValor} boton={v.activo ? "Desactivar" : "Activar"} ocultos={{ id: v.id, activo: v.activo ? "no" : "si" }} campos={[]} />}
                </li>
              ))}
              {(porCatalogo[clave] ?? []).length === 0 && <li className="opacity-70">Sin valores.</li>}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-extrabold">Temporadas</h2>
      {modifica && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Nueva temporada</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionTemporada} boton="Crear temporada" campos={[{ nombre: "nombre", etiqueta: "Nombre", requerido: true }, { nombre: "desde", etiqueta: "Desde", tipo: "date", requerido: true }, { nombre: "hasta", etiqueta: "Hasta", tipo: "date", requerido: true }]} />
          </div>
        </details>
      )}
      <ul className="space-y-1 text-sm">{a.temporadas.map((t) => <li key={t.id} className="rounded-lg bg-white px-3 py-2">{t.nombre}: {t.desde} a {t.hasta}</li>)}{a.temporadas.length === 0 && <li>Sin temporadas.</li>}</ul>

      <h2 className="text-xl font-extrabold">Parámetros operativos</h2>
      {modifica && (
        <details className="rounded-xl border-2 border-cafe/20 bg-white p-4">
          <summary className="min-h-11 cursor-pointer text-lg font-extrabold">Guardar parámetro</summary>
          <div className="mt-3">
            <FormularioGenerico accion={accionParametro} boton="Guardar" campos={[
              { nombre: "clave", etiqueta: "Parámetro", tipo: "select", opciones: a.definiciones.map((d) => ({ valor: d.clave, texto: `${d.descripcion} [${d.min}–${d.max}]` })) },
              { nombre: "valor", etiqueta: "Valor", tipo: "number", requerido: true },
              { nombre: "fincaId", etiqueta: "Ámbito", tipo: "select", opciones: [{ valor: "", texto: "Toda la organización" }, ...fincas.map((f) => ({ valor: f.id, texto: f.nombre }))] },
            ]} />
          </div>
        </details>
      )}
      <ul className="space-y-1 text-sm">
        {a.parametros.map((p, i) => <li key={i} className="rounded-lg bg-white px-3 py-2"><strong>{p.clave}</strong> = {p.valor} · {p.fincaNombre ?? "organización"}</li>)}
        {a.parametros.length === 0 && <li>Sin parámetros configurados: las operaciones usan su comportamiento por defecto (sin descuentos autorizados).</li>}
      </ul>
    </section>
  );
}
