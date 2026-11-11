/** Marca del sistema: un grano de café sobre un cuadrado redondeado. Sin dependencias ni imágenes externas. */
export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Gestión de Finca Cafetera">
      <rect width="40" height="40" rx="10" fill="#2d5a4d" />
      <ellipse cx="20" cy="20" rx="8.5" ry="11.5" transform="rotate(25 20 20)" fill="#f6f5f1" />
      <path d="M15.5 11.5c5 3.2 4.5 6.3 1 8.7-3.5 2.4-3 5.6 2.5 9" transform="rotate(25 20 20)" fill="none" stroke="#2d5a4d" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
