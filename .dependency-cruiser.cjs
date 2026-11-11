/**
 * Regla de capas (ADR-001, QA-13). Si alguien salta una capa, `npm run capas` falla y el CI se detiene.
 *
 *   presentación (src/app) → composición (src/composicion) → aplicación → dominio ← infraestructura
 */
const modulo = "^src/modules/[^/]+";

module.exports = {
  forbidden: [
    {
      name: "presentacion-no-toca-infraestructura",
      comment: "La presentación nunca importa infraestructura, el ORM ni la base de datos.",
      severity: "error",
      from: { path: "^src/app" },
      to: {
        path: [`${modulo}/infrastructure`, "^src/shared/infraestructura", "^src/modules/[^/]+/domain", `${modulo}/application`],
      },
    },
    {
      name: "presentacion-no-importa-pg",
      comment: "Ningún archivo de src/app puede usar el cliente de PostgreSQL ni argon2 directamente.",
      severity: "error",
      from: { path: "^src/app" },
      to: { path: "node_modules/(pg|@node-rs)/" },
    },
    {
      name: "dominio-es-puro",
      comment: "El dominio solo depende de dominio (propio o compartido).",
      severity: "error",
      from: { path: `${modulo}/domain` },
      to: {
        pathNot: [`${modulo}/domain`, "^src/shared/dominio"],
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "dominio-no-importa-tipos-de-capas-superiores",
      severity: "error",
      from: { path: `${modulo}/domain` },
      to: { path: [`${modulo}/application`, `${modulo}/infrastructure`, "^src/app", "^src/composicion"] },
    },
    {
      name: "aplicacion-no-toca-infraestructura-ni-presentacion",
      severity: "error",
      from: { path: `${modulo}/application` },
      to: { path: [`${modulo}/infrastructure`, "^src/shared/infraestructura", "^src/app", "^src/composicion"] },
    },
    {
      name: "aplicacion-no-importa-pg",
      severity: "error",
      from: { path: `${modulo}/application|^src/shared/(aplicacion|dominio)|${modulo}/domain` },
      to: { path: "node_modules/(pg|@node-rs)/" },
    },
    {
      name: "infraestructura-no-toca-aplicacion-ni-presentacion",
      severity: "error",
      from: { path: `${modulo}/infrastructure` },
      to: { path: [`${modulo}/application`, "^src/app", "^src/composicion"] },
    },
    {
      name: "modulos-solo-por-aplicacion",
      comment: "Un módulo usa a otro únicamente a través de su capa de aplicación.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/[^/]+/(domain|infrastructure)",
        pathNot: "^src/modules/$1/",
      },
    },
    {
      name: "solo-la-presentacion-usa-la-composicion",
      severity: "error",
      from: { path: "^src/(modules|shared)" },
      to: { path: "^src/composicion" },
    },
    {
      name: "sin-ciclos",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    exclude: { path: "\\.test\\.ts$" },
  },
};
