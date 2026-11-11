import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // En las páginas del servidor se capturan errores de NEGOCIO (permiso denegado) para mostrar un
    // mensaje; no son errores de renderizado, así que la regla de límites de error no aplica.
    files: ["src/app/**/page.tsx"],
    rules: { "react-hooks/error-boundaries": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".pgdata/**"]),
]);

export default eslintConfig;
