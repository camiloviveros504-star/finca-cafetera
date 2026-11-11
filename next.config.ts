import type { NextConfig } from "next";

const produccion = process.env.NODE_ENV === "production";
// HSTS y la mejora a HTTPS solo cuando el sitio se sirve por HTTPS (Vercel o APP_URL con https); en http://localhost romperían el uso local.
const https = produccion && (process.env.VERCEL === "1" || (process.env.APP_URL ?? "").startsWith("https://"));

/**
 * Política de contenido: solo recursos propios. 'unsafe-inline' en scripts es necesario para la hidratación de Next.js
 * sin nonces; en desarrollo se agrega 'unsafe-eval' (solo lo usa el recargador en caliente). frame-ancestors 'none'
 * impide incrustar el sitio en otro (clickjacking) y form-action 'self' impide enviar formularios a otro origen.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${produccion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

const encabezadosSeguridad = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg", "@node-rs/argon2"],
  async headers() {
    return [
      { source: "/:path*", headers: encabezadosSeguridad },
      // Las respuestas autenticadas y los reportes nunca se guardan en cachés compartidas ni del navegador.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
