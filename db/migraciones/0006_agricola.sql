-- 0006 · Extensiones 4, 5 y 6 (contexto "Gestión agrícola ampliada", prompt §9):
-- sanidad e inspecciones, planificación agrícola y maquinaria. Los movimientos de agroquímicos son inmutables.

-- ───────────── Sanidad ─────────────
CREATE TABLE inspeccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  lote_id uuid,
  fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('broca','roya','plaga','enfermedad','general')),
  severidad text NOT NULL CHECK (severidad IN ('ninguna','baja','media','alta')),
  infestacion_pct numeric(5,2) CHECK (infestacion_pct IS NULL OR (infestacion_pct >= 0 AND infestacion_pct <= 100)),
  hallazgos text NOT NULL,
  acciones text,
  clave_idempotencia text NOT NULL,
  inspector_id uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  UNIQUE (organizacion_id, clave_idempotencia)
);

CREATE TABLE agroquimico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  nombre text NOT NULL,
  unidad text NOT NULL,                              -- litro, kg, etc.
  carencia_dias integer CHECK (carencia_dias IS NULL OR carencia_dias >= 0),   -- período de carencia, dato del producto (configurable)
  activo boolean NOT NULL DEFAULT true,
  UNIQUE (organizacion_id, nombre)
);

-- Existencias por lote comercial con vencimiento; la cantidad nunca queda negativa.
CREATE TABLE agroquimico_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  agroquimico_id uuid NOT NULL REFERENCES agroquimico(id),
  lote_comercial text NOT NULL,
  vencimiento date NOT NULL,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad >= 0),
  UNIQUE (finca_id, agroquimico_id, lote_comercial)
);

CREATE TABLE agroquimico_movimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  stock_id uuid NOT NULL REFERENCES agroquimico_stock(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada','aplicacion','baja')),
  delta numeric(14,3) NOT NULL CHECK (delta <> 0),
  origen_id uuid,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  nota text
);
CREATE TRIGGER agroquimico_movimiento_inmutable BEFORE UPDATE OR DELETE ON agroquimico_movimiento
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

CREATE TABLE aplicacion_agroquimica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  lote_id uuid NOT NULL,
  stock_id uuid NOT NULL REFERENCES agroquimico_stock(id),
  fecha date NOT NULL,
  dosis numeric(14,3) NOT NULL CHECK (dosis > 0),
  unidad_dosis text NOT NULL,
  cantidad_total numeric(14,3) NOT NULL CHECK (cantidad_total > 0),
  fecha_reingreso date,                              -- fecha + carencia del producto (cosecha segura)
  inspeccion_id uuid REFERENCES inspeccion(id),
  responsable_id uuid NOT NULL REFERENCES usuario(id),
  clave_idempotencia text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  UNIQUE (organizacion_id, clave_idempotencia)
);
CREATE TRIGGER aplicacion_inmutable BEFORE UPDATE OR DELETE ON aplicacion_agroquimica
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

CREATE TABLE registro_ambiental (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('envases','residuos','agua','erosion','otro')),
  descripcion text NOT NULL,
  cantidad numeric(14,3),
  unidad text,
  clave_idempotencia text NOT NULL,
  responsable_id uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, clave_idempotencia)
);

-- ───────────── Planificación agrícola ─────────────
CREATE TABLE actividad_programada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  lote_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('floracion','fertilizacion','sombrio','arvenses','plagas','enfermedades','renovacion','cosecha','otra')),
  titulo text NOT NULL,
  fecha_programada date NOT NULL,
  estado text NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada','completada','cancelada')),
  fecha_cierre date,
  resultado text,
  clave_idempotencia text NOT NULL,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  UNIQUE (organizacion_id, clave_idempotencia),
  CHECK (estado = 'programada' OR fecha_cierre IS NOT NULL)
);

CREATE TABLE proyeccion_cosecha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  lote_id uuid NOT NULL,
  temporada_id uuid REFERENCES temporada(id),
  desde date NOT NULL,
  hasta date NOT NULL,
  cantidad_estimada_kg numeric(14,3) NOT NULL CHECK (cantidad_estimada_kg > 0),
  nota text,
  clave_idempotencia text NOT NULL,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  UNIQUE (organizacion_id, clave_idempotencia),
  CHECK (hasta >= desde)
);

-- ───────────── Maquinaria y herramientas ─────────────
CREATE TABLE equipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  tipo text NOT NULL CHECK (tipo IN ('maquinaria','herramienta','vehiculo')),
  codigo text NOT NULL,
  nombre text NOT NULL,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','en_mantenimiento','baja')),
  intervalo_mantenimiento_dias integer CHECK (intervalo_mantenimiento_dias IS NULL OR intervalo_mantenimiento_dias > 0),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, codigo)
);

CREATE TABLE uso_equipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  equipo_id uuid NOT NULL REFERENCES equipo(id),
  fecha date NOT NULL,
  horas numeric(8,2) NOT NULL CHECK (horas > 0),
  combustible_litros numeric(8,2) CHECK (combustible_litros IS NULL OR combustible_litros >= 0),
  nota text,
  clave_idempotencia text NOT NULL,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, clave_idempotencia)
);

CREATE TABLE mantenimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  equipo_id uuid NOT NULL REFERENCES equipo(id),
  fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('preventivo','correctivo','calibracion')),
  descripcion text NOT NULL,
  costo numeric(14,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  proximo_en date,
  gasto_id uuid REFERENCES gasto(id),                -- el costo se refleja como gasto financiero
  clave_idempotencia text NOT NULL,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, clave_idempotencia)
);

INSERT INTO permiso (codigo, descripcion) VALUES
  ('inspeccion:ver','Consultar inspecciones y registros ambientales'),
  ('inspeccion:registrar','Registrar inspecciones y registros ambientales'),
  ('agroquimico:ver','Consultar el inventario de agroquímicos y las aplicaciones'),
  ('agroquimico:administrar','Registrar entradas y bajas de agroquímicos'),
  ('aplicacion:registrar','Registrar aplicaciones de agroquímicos'),
  ('planificacion:ver','Consultar la planificación agrícola'),
  ('planificacion:administrar','Programar actividades y proyecciones de cosecha'),
  ('equipo:ver','Consultar maquinaria, usos y mantenimientos'),
  ('equipo:administrar','Crear equipos y registrar mantenimientos'),
  ('equipo:registrar_uso','Registrar el uso de equipos');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r CROSS JOIN permiso p
 WHERE r.codigo = 'administrador' AND p.codigo IN
  ('inspeccion:ver','inspeccion:registrar','agroquimico:ver','agroquimico:administrar','aplicacion:registrar','planificacion:ver','planificacion:administrar','equipo:ver','equipo:administrar','equipo:registrar_uso');
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN
  ('inspeccion:ver','inspeccion:registrar','agroquimico:ver','aplicacion:registrar','planificacion:ver','planificacion:administrar','equipo:ver','equipo:registrar_uso')
 WHERE r.codigo = 'encargado_produccion';
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('inspeccion:ver','inspeccion:registrar','planificacion:ver','equipo:ver','equipo:registrar_uso')
 WHERE r.codigo = 'supervisor_campo';
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('agroquimico:ver','agroquimico:administrar','equipo:ver')
 WHERE r.codigo = 'responsable_bodega';
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('inspeccion:ver','agroquimico:ver','planificacion:ver','equipo:ver')
 WHERE r.codigo = 'auditor';
