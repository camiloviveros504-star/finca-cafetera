import { z } from "zod";

/** Contraseñas demasiado comunes o predecibles: se rechazan aunque cumplan el largo. */
const COMUNES = ["password", "contrasena", "contraseña", "12345678", "123456789", "qwerty", "admin123", "colombia", "cafetero", "finca2026", "abc12345"];

/**
 * Política de contraseñas: mínimo 10 caracteres, letras y números, sin contener el usuario del correo ni palabras muy
 * comunes. Devuelve el mensaje de error o null si es aceptable. El almacenamiento (Argon2id) está en la infraestructura.
 */
export function problemaDeContrasena(contrasena: string, correo?: string): string | null {
  if (contrasena.length < 10) return "La contraseña debe tener al menos 10 caracteres";
  if (contrasena.length > 128) return "La contraseña es demasiado larga";
  if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) return "Use letras y números";
  const minuscula = contrasena.toLowerCase();
  if (COMUNES.some((c) => minuscula.includes(c))) return "Esa contraseña es demasiado común; elija otra";
  const usuario = correo?.split("@")[0]?.toLowerCase();
  if (usuario && usuario.length >= 4 && minuscula.includes(usuario)) return "La contraseña no debe contener su usuario de correo";
  if (/^(.)\1+$/.test(contrasena)) return "La contraseña no puede repetir un solo carácter";
  return null;
}

/** Esquema Zod reutilizable (el correo es opcional y se usa para rechazar contraseñas que lo contengan). */
export function esquemaContrasena(correo?: string) {
  return z.string().superRefine((v, ctx) => {
    const p = problemaDeContrasena(v, correo);
    if (p) ctx.addIssue({ code: "custom", message: p });
  });
}
