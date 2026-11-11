-- Control de plagas y enfermedades por lote. Un caso nace cuando se detecta un problema en un lote (broca, roya…), lleva una
-- descripción para tratarlo y avanza por estados con su historial: detectado → en tratamiento → mejorando → controlado.
-- Si reaparece, se reabre. Cada seguimiento puede ligarse a la fumigación (aplicación) con que se trató.
-- Relaciones en un solo sentido (sin ciclos): caso → lote e inspección; seguimiento → caso y aplicación.

CREATE TABLE caso_sanitario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  lote_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('broca','roya','mancha_hierro','ojo_gallo','cochinilla','minador','llaga','antracnosis','otra')),
  otro_nombre text,                                            -- nombre del problema cuando el tipo es "otra"
  severidad text NOT NULL CHECK (severidad IN ('baja','media','alta')),
  afectacion_pct numeric(5,2) CHECK (afectacion_pct IS NULL OR (afectacion_pct >= 0 AND afectacion_pct <= 100)),
  descripcion text NOT NULL,
  estado text NOT NULL DEFAULT 'detectado' CHECK (estado IN ('detectado','en_tratamiento','mejorando','controlado')),
  detectado_en date NOT NULL,
  controlado_en date,
  inspeccion_id uuid REFERENCES inspeccion(id),
  clave_idempotencia text NOT NULL,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  UNIQUE (organizacion_id, clave_idempotencia),
  CHECK (tipo <> 'otra' OR otro_nombre IS NOT NULL),
  CHECK ((estado = 'controlado') = (controlado_en IS NOT NULL))
);
CREATE INDEX caso_sanitario_lote ON caso_sanitario (lote_id, estado);

CREATE TABLE caso_sanitario_seguimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  caso_id uuid NOT NULL REFERENCES caso_sanitario(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  estado text NOT NULL CHECK (estado IN ('detectado','en_tratamiento','mejorando','controlado')),
  nota text NOT NULL,
  aplicacion_id uuid REFERENCES aplicacion_agroquimica(id),
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX caso_sanitario_seguimiento_caso ON caso_sanitario_seguimiento (caso_id, fecha);
