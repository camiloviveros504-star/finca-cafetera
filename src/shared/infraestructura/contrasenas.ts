import { hash, verify } from "@node-rs/argon2";

/** Argon2id es el algoritmo por defecto de @node-rs/argon2. */
export function cifrarContrasena(contrasena: string): Promise<string> {
  return hash(contrasena, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verificarContrasena(cifrada: string, contrasena: string): Promise<boolean> {
  try {
    return await verify(cifrada, contrasena);
  } catch {
    return false;
  }
}

let relleno: Promise<string> | undefined;

export function hashDeRelleno(): Promise<string> {
  relleno ??= cifrarContrasena("relleno-para-igualar-tiempos");
  return relleno;
}
