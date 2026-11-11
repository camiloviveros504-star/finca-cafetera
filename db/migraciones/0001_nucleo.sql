-- 0001 · Núcleo: identidad, producción, inventario, comercial, configuración, auditoría.
-- Reglas de integridad (no configurables): existencias >= 0, cosecha con lote de su finca,
-- movimientos inmutables, auditoría append-only, vigencias de tarifas sin solapamiento.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ===== Identidad y acceso =====
CREATE TABLE organizacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  es_demo boolean NOT NULL DEFAULT false,
  creada_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  nombre text NOT NULL,
  ubicacion text,
  area_ha numeric(10,2) CHECK (area_ha IS NULL OR area_ha > 0),
  activa boolean NOT NULL DEFAULT true,
  creada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, nombre),
  UNIQUE (id, organizacion_id)
);

CREATE TABLE usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  correo text NOT NULL,
  nombre text NOT NULL,
  password_hash text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  autorizo_tratamiento_en timestamptz,          -- Ley 1581: autorización del titular
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organizacion_id)
);
CREATE UNIQUE INDEX usuario_correo_unico ON usuario (lower(correo));

CREATE TABLE rol (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  es_extension boolean NOT NULL DEFAULT false
);

CREATE TABLE permiso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,                  -- recurso:accion, p. ej. venta:crear
  descripcion text NOT NULL
);

CREATE TABLE rol_permiso (
  rol_id uuid NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
  permiso_id uuid NOT NULL REFERENCES permiso(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuario_rol (
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rol_id uuid NOT NULL REFERENCES rol(id),
  PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE usuario_permiso_extra (
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  permiso_id uuid NOT NULL REFERENCES permiso(id),
  PRIMARY KEY (usuario_id, permiso_id)
);

-- Alcance por finca. Un usuario solo opera en las fincas listadas aquí.
CREATE TABLE usuario_finca (
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  finca_id uuid NOT NULL REFERENCES finca(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, finca_id)
);

CREATE TABLE sesion (
  token_hash text PRIMARY KEY,                  -- SHA-256 del token; el token nunca se guarda
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  creada_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL,
  csrf_token text NOT NULL
);
CREATE INDEX sesion_usuario_idx ON sesion (usuario_id);

CREATE TABLE intento_acceso (
  id bigserial PRIMARY KEY,
  correo_hash text NOT NULL,                    -- SHA-256 del correo: no se guarda en claro
  ip text NOT NULL,
  exitoso boolean NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX intento_acceso_correo_idx ON intento_acceso (correo_hash, creado_en DESC);
CREATE INDEX intento_acceso_ip_idx ON intento_acceso (ip, creado_en DESC);

-- ===== Auditoría (append-only) =====
CREATE TABLE auditoria (
  id bigserial PRIMARY KEY,
  organizacion_id uuid,
  usuario_id uuid,
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id text,
  resultado text NOT NULL CHECK (resultado IN ('ok','denegado','error')),
  antes jsonb,
  despues jsonb,
  ip text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_org_fecha_idx ON auditoria (organizacion_id, creado_en DESC);
CREATE INDEX auditoria_entidad_idx ON auditoria (entidad, entidad_id);

CREATE FUNCTION bloquear_modificacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción (% no permitido)', TG_TABLE_NAME, TG_OP;
END $$;

CREATE TRIGGER auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

-- ===== Configuración y tarifas =====
CREATE TABLE unidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,                  -- kg, arroba, carga, jornada, saco
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('masa','tiempo','conteo'))
);

CREATE TABLE conversion_unidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid REFERENCES finca(id),           -- NULL = ámbito general de la organización
  unidad_origen_id uuid NOT NULL REFERENCES unidad(id),
  unidad_destino_id uuid NOT NULL REFERENCES unidad(id),
  factor numeric(18,6) NOT NULL CHECK (factor > 0),
  vigencia daterange NOT NULL,
  es_demo boolean NOT NULL DEFAULT false,
  creada_por uuid REFERENCES usuario(id),
  creada_en timestamptz NOT NULL DEFAULT now(),
  CHECK (unidad_origen_id <> unidad_destino_id),
  EXCLUDE USING gist (
    organizacion_id WITH =,
    (COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    unidad_origen_id WITH =,
    unidad_destino_id WITH =,
    vigencia WITH &&
  )
);

CREATE TABLE catalogo_valor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  catalogo text NOT NULL,                       -- metodo_pago, tipo_gasto, estado_operativo, tipo_cafe, categoria_producto
  codigo text NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  UNIQUE (organizacion_id, catalogo, codigo)
);

CREATE TABLE parametro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid REFERENCES finca(id),
  clave text NOT NULL,
  valor jsonb NOT NULL,
  actualizado_por uuid REFERENCES usuario(id),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX parametro_unico ON parametro
  (organizacion_id, COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid), clave);

CREATE TABLE temporada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  nombre text NOT NULL,
  vigencia daterange NOT NULL,
  EXCLUDE USING gist (organizacion_id WITH =, vigencia WITH &&)
);

-- ===== Inventario: productos y bodegas =====
CREATE TABLE producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  codigo text NOT NULL,
  nombre text NOT NULL,
  tipo_cafe text,                               -- valor de catalogo_valor (tipo_cafe)
  categoria text,                               -- valor de catalogo_valor (categoria_producto)
  unidad_id uuid NOT NULL REFERENCES unidad(id),
  vendible boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  es_demo boolean NOT NULL DEFAULT false,
  UNIQUE (organizacion_id, codigo),
  UNIQUE (id, organizacion_id)
);

-- Tarifas versionadas: el concepto (tarifa) y sus valores con vigencia (tarifa_version).
CREATE TABLE tarifa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid REFERENCES finca(id),
  codigo text NOT NULL,                         -- p. ej. precio_venta
  tipo text NOT NULL CHECK (tipo IN ('precio_venta','precio_compra','pago_kg','pago_arroba','pago_jornada','pago_actividad','especial')),
  producto_id uuid REFERENCES producto(id),
  unidad_id uuid NOT NULL REFERENCES unidad(id),
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','inactiva')),
  creada_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tarifa_unica ON tarifa (
  organizacion_id,
  COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid),
  codigo,
  COALESCE(producto_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE TABLE tarifa_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarifa_id uuid NOT NULL REFERENCES tarifa(id),
  version integer NOT NULL CHECK (version > 0),
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  vigencia daterange NOT NULL,
  es_demo boolean NOT NULL DEFAULT false,
  creada_por uuid REFERENCES usuario(id),
  creada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarifa_id, version),
  EXCLUDE USING gist (tarifa_id WITH =, vigencia WITH &&)
);

CREATE TRIGGER tarifa_version_inmutable
  BEFORE DELETE ON tarifa_version
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

-- ===== Producción =====
CREATE TABLE lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  codigo text NOT NULL,
  nombre text NOT NULL,
  area_ha numeric(10,2) CHECK (area_ha IS NULL OR area_ha > 0),
  variedad text,
  numero_arboles integer CHECK (numero_arboles IS NULL OR numero_arboles >= 0),
  fecha_siembra date,
  estado_productivo text NOT NULL DEFAULT 'produccion' CHECK (estado_productivo IN ('levante','produccion','renovacion','inactivo')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id),
  UNIQUE (finca_id, codigo),
  UNIQUE (id, finca_id)
);

CREATE TABLE bodega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  nombre text NOT NULL,
  FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id),
  UNIQUE (finca_id, nombre),
  UNIQUE (id, finca_id)
);

-- Cosecha: siempre con lote de la misma finca (clave compuesta) → QA-04.
CREATE TABLE cosecha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  lote_id uuid NOT NULL,
  producto_id uuid NOT NULL REFERENCES producto(id),
  bodega_id uuid NOT NULL,
  fecha date NOT NULL,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  unidad_id uuid NOT NULL REFERENCES unidad(id),
  cantidad_base numeric(14,3) NOT NULL CHECK (cantidad_base > 0),  -- en la unidad del producto, tras conversión
  factor_aplicado numeric(18,6) NOT NULL CHECK (factor_aplicado > 0),
  estado text NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','anulada')),
  clave_idempotencia uuid NOT NULL UNIQUE,       -- generada en el cliente (cola offline)
  capturada_en timestamptz NOT NULL,             -- reloj del dispositivo
  recibida_en timestamptz NOT NULL DEFAULT now(),-- reloj del servidor
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  nota text,
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
);
CREATE INDEX cosecha_lote_fecha_idx ON cosecha (lote_id, fecha DESC);
CREATE INDEX cosecha_finca_fecha_idx ON cosecha (finca_id, fecha DESC);

-- ===== Inventario: saldos (proyección) y movimientos (hechos inmutables) =====
CREATE TABLE saldo_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  bodega_id uuid NOT NULL,
  producto_id uuid NOT NULL REFERENCES producto(id),
  lote_id uuid NOT NULL,                         -- lote de cultivo de origen
  cantidad numeric(14,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  UNIQUE (bodega_id, producto_id, lote_id)
);
CREATE INDEX saldo_producto_idx ON saldo_inventario (finca_id, producto_id) WHERE cantidad > 0;

CREATE TABLE movimiento_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  bodega_id uuid NOT NULL,
  producto_id uuid NOT NULL REFERENCES producto(id),
  lote_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN (
    'existencia_inicial','entrada','salida','ajuste','perdida',
    'traslado_salida','traslado_entrada','transformacion_salida','transformacion_entrada',
    'reserva','conteo_fisico','reverso')),
  delta numeric(14,3) NOT NULL,                  -- positivo suma, negativo resta
  origen_tipo text NOT NULL CHECK (origen_tipo IN ('cosecha','transformacion','venta','ajuste','traslado','reverso','manual','compra')),
  origen_id uuid,
  revierte_a uuid REFERENCES movimiento_inventario(id),
  clave_idempotencia text UNIQUE,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  nota text,
  FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  CHECK (delta <> 0 OR tipo = 'conteo_fisico')
);
CREATE INDEX movimiento_origen_idx ON movimiento_inventario (origen_tipo, origen_id);
CREATE INDEX movimiento_lote_idx ON movimiento_inventario (lote_id, producto_id, creado_en);
CREATE INDEX movimiento_finca_fecha_idx ON movimiento_inventario (finca_id, creado_en DESC);

CREATE TRIGGER movimiento_inmutable
  BEFORE UPDATE OR DELETE ON movimiento_inventario
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

-- Un movimiento solo puede revertirse una vez.
CREATE UNIQUE INDEX movimiento_un_reverso ON movimiento_inventario (revierte_a) WHERE revierte_a IS NOT NULL;

CREATE TABLE transformacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  bodega_id uuid NOT NULL,
  tipo text NOT NULL,                            -- p. ej. pergamino_seco_a_excelso
  fecha date NOT NULL,
  factor_rendimiento numeric(8,3),               -- FR informado (parámetro, no constante)
  clave_idempotencia text UNIQUE,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  nota text,
  FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
);

CREATE TABLE transformacion_linea (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transformacion_id uuid NOT NULL REFERENCES transformacion(id),
  lote_id uuid NOT NULL,
  finca_id uuid NOT NULL,
  producto_entrada_id uuid NOT NULL REFERENCES producto(id),
  producto_salida_id uuid NOT NULL REFERENCES producto(id),
  cantidad_entrada numeric(14,3) NOT NULL CHECK (cantidad_entrada > 0),
  cantidad_salida numeric(14,3) NOT NULL CHECK (cantidad_salida > 0),
  cantidad_perdida numeric(14,3) NOT NULL DEFAULT 0 CHECK (cantidad_perdida >= 0),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
);
CREATE INDEX transformacion_linea_idx ON transformacion_linea (lote_id, producto_salida_id);

-- ===== Comercial =====
CREATE TABLE cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  nombre text NOT NULL,
  documento text,
  telefono text,
  correo text,
  direccion text,
  finalidad_tratamiento text NOT NULL DEFAULT 'Gestión comercial y cartera de ventas de café',
  autorizo_tratamiento_en timestamptz,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organizacion_id)
);
CREATE INDEX cliente_org_nombre_idx ON cliente (organizacion_id, lower(nombre));

CREATE SEQUENCE comprobante_seq;

CREATE TABLE pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT current_date,
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','facturado','cancelado')),
  nota text,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id),
  FOREIGN KEY (cliente_id, organizacion_id) REFERENCES cliente(id, organizacion_id),
  UNIQUE (id, organizacion_id)
);

CREATE TABLE pedido_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES producto(id),
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0)
);

CREATE TABLE venta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  pedido_id uuid REFERENCES pedido(id),
  numero_comprobante bigint NOT NULL DEFAULT nextval('comprobante_seq'),  -- comprobante interno, no es factura DIAN
  fecha timestamptz NOT NULL DEFAULT now(),
  estado text NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','anulada')),
  descuento_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (descuento_total >= 0),
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  clave_idempotencia text NOT NULL,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  nota text,
  FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id),
  FOREIGN KEY (cliente_id, organizacion_id) REFERENCES cliente(id, organizacion_id),
  UNIQUE (organizacion_id, clave_idempotencia),
  UNIQUE (id, organizacion_id)
);
CREATE INDEX venta_finca_fecha_idx ON venta (finca_id, fecha DESC);
CREATE INDEX venta_cliente_idx ON venta (cliente_id, fecha DESC);

CREATE TABLE venta_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES venta(id),
  producto_id uuid NOT NULL REFERENCES producto(id),
  lote_id uuid NOT NULL,                         -- lote de origen
  finca_id uuid NOT NULL,
  bodega_id uuid NOT NULL,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(14,2) NOT NULL CHECK (precio_unitario >= 0),   -- valor aplicado
  tarifa_version_id uuid REFERENCES tarifa_version(id),                  -- versión de tarifa usada
  descuento numeric(14,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  movimiento_id uuid NOT NULL REFERENCES movimiento_inventario(id),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
);
CREATE INDEX venta_detalle_venta_idx ON venta_detalle (venta_id);
CREATE INDEX venta_detalle_lote_idx ON venta_detalle (lote_id, producto_id);

CREATE TABLE pago_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  venta_id uuid NOT NULL REFERENCES venta(id),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  metodo text NOT NULL,                          -- valor de catalogo_valor (metodo_pago)
  fecha timestamptz NOT NULL DEFAULT now(),
  clave_idempotencia text NOT NULL,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  UNIQUE (organizacion_id, clave_idempotencia)
);
CREATE INDEX pago_venta_idx ON pago_cliente (venta_id);

-- Control de migraciones lo crea el ejecutor (db/migrar.ts).
