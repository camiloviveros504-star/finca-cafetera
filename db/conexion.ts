import { Client } from "pg";

/** Opciones SSL: obligatorio para hosts remotos (Render); sin SSL solo para localhost. */
export function opcionesSsl(url: string): false | { rejectUnauthorized: boolean } {
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "db";
  return local ? false : { rejectUnauthorized: false };
}

export function urlBaseDatos(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL");
  return url;
}

export async function conectar(url = urlBaseDatos()): Promise<Client> {
  const cliente = new Client({ connectionString: url, ssl: opcionesSsl(url) });
  await cliente.connect();
  return cliente;
}
