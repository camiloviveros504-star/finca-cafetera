import { ErrorProhibido, listarFincasYLotes, obtenerAjustes, servicios, type ValorCatalogo } from "@/composicion";
import { EncabezadoModulo } from "../../../_componentes/EncabezadoModulo";
import { FormularioGenerico } from "../../../_componentes/FormularioGenerico";
import { Tarjeta } from "../../../_componentes/Pestanas";
import { exigirContexto } from "../../../_servidor/sesion";
import { accionEquivalencia, accionEstadoValor, accionParametro, accionValorCatalogo } from "../../usuarios/acciones";

export const metadata = { title: "Ajustes de mi finca · Gestión de Finca Cafetera" };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const UNIDADES = [["arroba", "Arroba"], ["carga", "Carga"], ["saco", "Saco"], ["kg", "Kilo"]].map(([valor, texto]) => ({ valor, texto }));
const POR_DEFECTO: Record<string, string> = { arboles_por_hectarea: "5.000 (referencia Cenicafé)", descuento_maximo_pct: "0 % (no se permiten descuentos)" };
const NOMBRE_PARAMETRO: Record<string, string> = { arboles_por_hectarea: "Árboles por hectárea al sembrar", descuento_maximo_pct: "Descuento máximo en una venta (%)" };

function ListaCatalogo({ valores, modifica, variasFincas }: { valores: ValorCatalogo[]; modifica: boolean; variasFincas: boolean }) {
  return (
    <ul className="divide-y divide-borde rounded-lg border border-borde text-sm">
      {valores.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className={v.activo ? "" : "text-suave line-through"}>{v.nombre}</span>
          <span className="flex items-center gap-2 text-xs text-suave">
            {v.fincaId ? (variasFincas ? `De ${v.fincaNombre}` : "Agregado por usted") : "Del sistema"}
            {modifica && v.fincaId && (
              <FormularioGenerico compacto accion={accionEstadoValor} boton={v.activo ? "Desactivar" : "Activar"} ocultos={{ id: v.id, activo: v.activo ? "no" : "si" }} campos={[]} />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AjustesFinca() {
  const ctx = await exigirContexto();
  let a;
  try {
    a = await obtenerAjustes(servicios().ajustes, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">Los ajustes son de cada finca y los maneja su propietario.</p>;
    throw error;
  }
  const modifica = ctx.permisos.has("configuracion:modificar");
  const fincas = await listarFincasYLotes(servicios().fincasLotes, ctx).then((d) => d.fincas).catch(() => []);
  const variasFincas = fincas.length > 1;
  const unaFinca: Record<string, string> = fincas.length === 1 ? { fincaId: fincas[0].id } : {};
  const campoFinca = variasFincas ? [{ nombre: "fincaId", etiqueta: "Finca", tipo: "select" as const, opciones: fincas.map((f) => ({ valor: f.id, texto: f.nombre })), ancho: "completo" as const }] : [];
  const metodos = a.catalogos.filter((c) => c.catalogo === "metodo_pago");
  const gastos = a.catalogos.filter((c) => c.catalogo === "tipo_gasto");
  const equivalencias = a.equivalencias.filter((e) => e.vigente);

  if (fincas.length === 0) {
    return (
      <div className="space-y-6">
        <EncabezadoModulo titulo="Ajustes de mi finca" />
        <p className="rounded-xl border border-dashed border-borde bg-white p-6 text-sm text-suave">Todavía no tiene fincas asignadas. Cuando el administrador le asigne una, aquí podrá ajustar cómo trabaja.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EncabezadoModulo titulo="Ajustes de mi finca" detalle="Cómo trabaja su finca: con qué le pagan, en qué gasta, cuánto pesa una arroba para usted y cuántos árboles siembra por hectárea. Lo que cambie aquí aplica solo a su finca." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Métodos de pago">
          <p className="-mt-2 mb-3 text-sm text-suave">Las formas en que le pagan y en que usted paga. Aparecen al registrar ventas, compras, gastos y pagos. Ejemplo: agregue “Nequi” si cobra por ahí.</p>
          <ListaCatalogo valores={metodos} modifica={modifica} variasFincas={variasFincas} />
          {modifica && (
            <div className="mt-3">
              <FormularioGenerico compacto accion={accionValorCatalogo} boton="Agregar" ocultos={{ ...unaFinca, catalogo: "metodo_pago" }} campos={[...campoFinca, { nombre: "nombre", etiqueta: "Nuevo método de pago", requerido: true, placeholder: "Nequi, Daviplata…" }]} />
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Tipos de gasto">
          <p className="-mt-2 mb-3 text-sm text-suave">Las clases de gasto de su finca. Aparecen en la Billetera al registrar un gasto. Ejemplo: agregue “Energía del beneficiadero”.</p>
          <ListaCatalogo valores={gastos} modifica={modifica} variasFincas={variasFincas} />
          {modifica && (
            <div className="mt-3">
              <FormularioGenerico compacto accion={accionValorCatalogo} boton="Agregar" ocultos={{ ...unaFinca, catalogo: "tipo_gasto" }} campos={[...campoFinca, { nombre: "nombre", etiqueta: "Nuevo tipo de gasto", requerido: true, placeholder: "Energía, arriendo…" }]} />
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Equivalencias de unidades">
          <p className="-mt-2 mb-3 text-sm text-suave">Cuántos kilos tiene cada unidad en su finca. Se usan cuando alguien anota la cosecha en arrobas o cargas: el sistema la pasa a kilos. Ejemplo: 1 arroba = 12,5 kg. Si cambia, se crea una nueva desde una fecha y lo anterior no se altera.</p>
          {equivalencias.length === 0 ? <p className="text-sm text-suave">Aún no hay equivalencias: todo se registra en kilos.</p> : (
            <ul className="divide-y divide-borde rounded-lg border border-borde text-sm">
              {equivalencias.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                  <span>1 {e.origen} = <strong>{e.factor.replace(/\.?0+$/, "")}</strong> {e.destino}</span>
                  <span className="text-xs text-suave">desde {e.desde}{e.fincaId ? (variasFincas ? ` · ${e.fincaNombre}` : "") : " · del sistema"}</span>
                </li>
              ))}
            </ul>
          )}
          {modifica && (
            <details className="mt-3">
              <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-bosque">Agregar o cambiar una equivalencia</summary>
              <FormularioGenerico accion={accionEquivalencia} boton="Guardar" ocultos={unaFinca} campos={[
                ...campoFinca,
                { nombre: "origen", etiqueta: "1 unidad de", tipo: "select", opciones: UNIDADES.filter((u) => u.valor !== "kg") },
                { nombre: "factor", etiqueta: "Equivale a (kilos)", tipo: "number", requerido: true, placeholder: "12.5" },
                { nombre: "desde", etiqueta: "Desde", tipo: "date", requerido: true, valorInicial: hoy() },
              ]} />
            </details>
          )}
        </Tarjeta>

        <Tarjeta titulo="Valores de la finca">
          <p className="-mt-2 mb-3 text-sm text-suave">Valores que usa el sistema para sugerirle o para cuidar sus ventas.</p>
          <ul className="divide-y divide-borde rounded-lg border border-borde text-sm">
            {a.definiciones.map((d) => {
              const propios = a.parametros.filter((x) => x.clave === d.clave && x.fincaId);
              return (
                <li key={d.clave} className="px-3 py-2">
                  <p className="font-medium">{NOMBRE_PARAMETRO[d.clave] ?? d.descripcion}</p>
                  <p className="text-xs text-suave">
                    {propios.length === 0 ? `Usa el valor por defecto: ${POR_DEFECTO[d.clave] ?? "sin definir"}` : propios.map((x) => `${variasFincas ? `${x.fincaNombre}: ` : "Su valor: "}${x.valor}`).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
          {modifica && (
            <details className="mt-3">
              <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-bosque">Cambiar un valor</summary>
              <FormularioGenerico accion={accionParametro} boton="Guardar" ocultos={unaFinca} campos={[
                ...campoFinca,
                { nombre: "clave", etiqueta: "Valor", tipo: "select", opciones: a.definiciones.map((d) => ({ valor: d.clave, texto: `${NOMBRE_PARAMETRO[d.clave] ?? d.descripcion} (entre ${d.min} y ${d.max})` })), ancho: "completo" },
                { nombre: "valor", etiqueta: "Nuevo valor", tipo: "number", requerido: true },
              ]} />
            </details>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
