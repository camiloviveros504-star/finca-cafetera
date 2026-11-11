import { createHash, randomBytes } from "node:crypto";

export function sha256(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
