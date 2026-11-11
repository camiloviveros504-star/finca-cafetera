import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestión de Finca Cafetera",
  description: "Lotes, cosechas, inventario por movimientos, ventas y trazabilidad del lote a la venta.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b2416",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
