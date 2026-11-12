import Link from "next/link";
import { ErrorProhibido, listarFincasYLotes, listarUsuarios, servicios } from "@/composicion";
import { EncabezadoModulo } from "../../_componentes/EncabezadoModulo";
import { cantidad } from "../../_servidor/formatos";
import { exigirContexto } from "../../_servidor/sesion";

export const metadata = { title: "Fincas · Gestión de Finca Cafetera" };

const ESTADO_LOTE: Record<string, string> = { sin_sembrar: "Sin sembrar", levante: "Levante", produccion: "Producción", zoca: "Zoca", renovacion: "Renovación", inactivo: "Inactivo" };

type Finca = { id: string; nombre: string; ubicacion: string | null; areaHa: string | null; propietarioId: string | null; lotes: number };
type Lote = { id: string; fincaId: string; codigo: string; nombre: string; areaHa: string | null; estadoProductivo: string; cosechadoKg: string };

function TarjetaFinca({ f, lotes }: { f: Finca; lotes: Lote[] }) {
  return (
    <div className="rounded-lg border border-borde bg-fondo/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{f.nombre}</p>
        <p className="text-xs text-suave">{f.ubicacion ?? "Sin ubicación"} · {f.areaHa ? `${cantidad(f.areaHa)} ha` : "área sin registrar"}</p>
      </div>
      {lotes.length === 0 ? (
        <p className="mt-2 text-xs text-suave">Sin lotes todavía.</p>
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

/**
 * Vista del administrador de la plataforma: qué fincas tiene cada propietario y qué lotes hay en cada finca.
 * Es solo de consulta: las fincas las crea cada propietario desde su cuenta (Mis fincas) y los lotes también.
 */
export default async function Fincas() {
  const ctx = await exigirContexto();
  if (!ctx.permisos.has("finca:administrar")) return <p role="alert" className="font-semibold text-alerta">Esta sección es del administrador de la plataforma. Sus fincas están en “Mis fincas”.</p>;
  let datos, cuentas;
  try {
    datos = await listarFincasYLotes(servicios().fincasLotes, ctx);
    cuentas = await listarUsuarios(servicios().usuarios, ctx);
  } catch (error) {
    if (error instanceof ErrorProhibido) return <p role="alert" className="font-semibold text-alerta">No tiene permiso para consultar fincas.</p>;
    throw error;
  }
  const propietarios = cuentas.usuarios.filter((u) => u.roles.includes("propietario"));
  const deDueno = (id: string) => datos.fincas.filter((f) => f.propietarioId === id);
  const sinDueno = datos.fincas.filter((f) => !f.propietarioId || !propietarios.some((p) => p.id === f.propietarioId));
  const lotesDe = (fincaId: string) => datos.lotes.filter((l) => l.fincaId === fincaId);
  const totalHa = datos.fincas.reduce((s, f) => s + Number(f.areaHa ?? 0), 0);

  return (
    <div className="space-y-6">
      <EncabezadoModulo
        titulo="Fincas y propietarios"
        detalle={`${propietarios.length} propietario(s) · ${datos.fincas.length} finca(s) · ${datos.lotes.length} lote(s) · ${cantidad(totalHa)} ha. Cada propietario crea sus fincas y los lotes de cada una; aquí usted las consulta.`}
        accion={<Link href="/usuarios" className="inline-flex min-h-10 items-center rounded-lg bg-bosque px-4 text-sm font-semibold text-white hover:bg-bosque/90">Crear cuenta de propietario</Link>}
      />

      {propietarios.length === 0 && (
        <p className="rounded-xl border border-dashed border-borde bg-white p-6 text-center text-sm text-suave">
          Todavía no hay propietarios. Cree la cuenta del primero en <Link href="/usuarios" className="font-medium text-bosque underline">Cuentas</Link>; al entrar, él registra sus fincas y sus lotes.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {propietarios.map((p) => {
          const fincas = deDueno(p.id);
          return (
            <section key={p.id} className="min-w-0 rounded-xl border border-borde bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold">{p.nombre}</p>
                  <p className="truncate text-xs text-suave">{p.correo} · {p.pendiente ? "pendiente de activar" : p.activo ? "cuenta activa" : "cuenta desactivada"}</p>
                </div>
                <dl className="flex gap-5 text-right text-sm">
                  <div><dt className="text-xs text-suave">Fincas</dt><dd className="font-semibold tabular-nums">{fincas.length}</dd></div>
                  <div><dt className="text-xs text-suave">Capataces</dt><dd className="font-semibold tabular-nums">{p.equipo?.capataces ?? 0}</dd></div>
                  <div><dt className="text-xs text-suave">Trabajadores</dt><dd className="font-semibold tabular-nums">{p.equipo?.trabajadores ?? 0}</dd></div>
                </dl>
              </div>
              <div className="mt-4 space-y-3">
                {fincas.length === 0
                  ? <p className="text-sm text-suave">{p.pendiente ? "Cuando active su cuenta podrá registrar sus fincas." : "Aún no ha registrado fincas."}</p>
                  : fincas.map((f) => <TarjetaFinca key={f.id} f={f} lotes={lotesDe(f.id)} />)}
              </div>
            </section>
          );
        })}
      </div>

      {sinDueno.length > 0 && (
        <section className="rounded-xl border border-ambar/40 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Fincas sin propietario ({sinDueno.length})</h2>
          <p className="mt-1 text-xs text-suave">Fincas cuyo dueño ya no tiene cuenta de propietario.</p>
          <div className="mt-3 space-y-3">{sinDueno.map((f) => <TarjetaFinca key={f.id} f={f} lotes={lotesDe(f.id)} />)}</div>
        </section>
      )}
    </div>
  );
}
