import Link from "next/link";
import { consultarAuditoria, ErrorProhibido, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { fechaHora } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Auditoría · Gestión de Finca Cafetera" };
const POR_PAGINA = 30;

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ pagina?: string; resultado?: string; accion?: string }> }) {
  const ctx = await exigirContexto();
  const q = await searchParams;
  const pagina = Math.max(Number(q.pagina ?? 1) || 1, 1);
  let datos;
  try {
    datos = await consultarAuditoria(servicios().auditoria, ctx, { resultado: q.resultado, accion: q.accion }, pagina, POR_PAGINA);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar la auditoría.</p>;
    throw error;
  }
  const paginas = Math.max(Math.ceil(datos.total / POR_PAGINA), 1);
  const enlace = (p: number) => `/auditoria?pagina=${p}${q.resultado ? `&resultado=${q.resultado}` : ""}${q.accion ? `&accion=${encodeURIComponent(q.accion)}` : ""}`;
  return (
    <section className="space-y-4">
      <EncabezadoModulo titulo="Auditoría" detalle="Registro de solo inserción: no se edita ni se borra. No guarda contraseñas ni datos personales innecesarios." />
      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Resultado
          <select name="resultado" defaultValue={q.resultado ?? ""} className="mt-1 block min-h-11 rounded-lg border border-[#cdd3d0] px-3">
            <option value="">Todos</option><option value="ok">Correctos</option><option value="denegado">Denegados</option><option value="error">Con error</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Acción contiene
          <input name="accion" defaultValue={q.accion ?? ""} className="mt-1 block min-h-11 rounded-lg border border-[#cdd3d0] px-3" />
        </label>
        <button className="min-h-11 rounded-lg bg-bosque px-5 text-sm font-semibold text-white shadow-sm hover:bg-bosque/90">Filtrar</button>
      </form>
      <p className="text-sm">{datos.total} registro(s) · página {pagina} de {paginas}</p>
      <ul className="space-y-1 text-sm">
        {datos.filas.map((f) => (
          <li key={f.id} className={`rounded-lg border-l-4 bg-white px-3 py-2 ${f.resultado === "ok" ? "border-bosque" : f.resultado === "denegado" ? "border-alerta" : "border-ambar"}`}>
            <p><strong>{f.accion}</strong> · {f.entidad}{f.entidadId ? ` · ${f.entidadId.slice(0, 8)}` : ""} · {f.resultado} · {f.usuario ?? "sistema"} · {fechaHora(f.fecha)}{f.ip ? ` · ${f.ip}` : ""}</p>
            {f.detalle && <p className="break-words font-mono text-xs opacity-70">{f.detalle.slice(0, 240)}</p>}
          </li>
        ))}
      </ul>
      <nav className="flex gap-3" aria-label="Paginación">
        {pagina > 1 && <Link className="min-h-11 rounded-lg border border-[#cdd3d0] px-4 py-2 font-semibold" href={enlace(pagina - 1)}>Anterior</Link>}
        {pagina < paginas && <Link className="min-h-11 rounded-lg border border-[#cdd3d0] px-4 py-2 font-semibold" href={enlace(pagina + 1)}>Siguiente</Link>}
      </nav>
    </section>
  );
}
