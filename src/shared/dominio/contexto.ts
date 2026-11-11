/** Quién hace la solicitud y qué puede hacer. Se construye en el servidor a partir de la sesión. */
export interface ContextoUsuario {
  readonly usuarioId: string;
  readonly organizacionId: string;
  readonly nombre: string;
  readonly correo: string;
  readonly roles: readonly string[];
  readonly fincaIds: readonly string[];
  readonly permisos: ReadonlySet<string>;
  readonly csrfToken: string;
  readonly ip: string;
}

/** Marca opaca de una transacción abierta. Solo la infraestructura conoce su contenido. */
export interface Transaccion {
  readonly _tipo: "transaccion";
}
