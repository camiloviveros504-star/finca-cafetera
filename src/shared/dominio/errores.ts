/** Errores de negocio tipados. El mensaje es apto para mostrarse al usuario (sin detalles internos). */
export class ErrorNegocio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
    readonly estadoHttp: number = 422,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class ErrorNoAutenticado extends ErrorNegocio {
  constructor(mensaje = "Debe iniciar sesión para continuar") {
    super("no_autenticado", mensaje, 401);
  }
}

export class ErrorCredenciales extends ErrorNegocio {
  constructor() {
    super("credenciales_invalidas", "Correo o contraseña incorrectos", 401);
  }
}

export class ErrorBloqueado extends ErrorNegocio {
  constructor() {
    super("demasiados_intentos", "Demasiados intentos. Intente de nuevo más tarde", 429);
  }
}

export class ErrorProhibido extends ErrorNegocio {
  constructor() {
    super("prohibido", "No tiene permiso para realizar esta operación", 403);
  }
}

export class ErrorNoEncontrado extends ErrorNegocio {
  constructor(entidad: string) {
    super("no_encontrado", `${entidad} no encontrado`, 404);
  }
}

export class ErrorValidacion extends ErrorNegocio {
  constructor(
    mensaje: string,
    readonly campos: Record<string, string> = {},
  ) {
    super("validacion", mensaje, 400);
  }
}

export class ErrorExistenciasInsuficientes extends ErrorNegocio {
  constructor(
    readonly disponible: string,
    unidad = "kg",
  ) {
    super("existencias_insuficientes", `Existencias insuficientes: disponibles ${disponible} ${unidad}`, 409);
  }
}

export class ErrorRegla extends ErrorNegocio {
  constructor(mensaje: string, codigo = "regla_de_negocio") {
    super(codigo, mensaje, 422);
  }
}

/** La clave de idempotencia ya fue usada: el llamador debe devolver el resultado original. */
export class ErrorClaveDuplicada extends ErrorNegocio {
  constructor() {
    super("clave_duplicada", "La operación ya fue registrada", 409);
  }
}
