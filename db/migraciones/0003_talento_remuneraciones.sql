-- 0003 · Extensión 1: trabajadores, producción individual, liquidaciones, anticipos y pagos.
-- El sistema NO es software de nómina legal: calcula remuneración por producción/jornada y controla pagos internos.

INSERT INTO unidad (codigo, nombre, tipo) VALUES ('actividad', 'Actividad', 'conteo') ON CONFLICT (codigo) DO NOTHING;

-- Una tarifa de pago puede ser general, de una finca o de un trabajador (la más específica gana).
ALTER TABLE tarifa ADD COLUMN trabajador_id uuid;
ALTER TABLE tarifa ADD COLUMN temporada_id uuid REFERENCES temporada(id);

-- Datos personales separados de la vinculación laboral (Ley 1581: finalidad y autorización).
CREATE TABLE trabajador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  usuario_id uuid UNIQUE REFERENCES usuario(id),            -- si el trabajador entra al sistema (recolector)
  tipo_documento text NOT NULL DEFAULT 'CC' CHECK (tipo_documento IN ('CC','CE','TI','PEP','PPT','otro')),
  numero_documento text NOT NULL,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  telefono text,
  activo boolean NOT NULL DEFAULT true,
  autorizo_tratamiento_en timestamptz,                       -- fecha de la autorización de datos personales
  finalidad_tratamiento text,
  creado_por uuid REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, tipo_documento, numero_documento),
  UNIQUE (id, organizacion_id)
);
ALTER TABLE tarifa ADD CONSTRAINT tarifa_trabajador_fk FOREIGN KEY (trabajador_id) REFERENCES trabajador(id);

-- Cada trabajador puede tener una modalidad distinta por finca y período.
CREATE TABLE vinculacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  trabajador_id uuid NOT NULL REFERENCES trabajador(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  modalidad text NOT NULL CHECK (modalidad IN ('kg','arroba','jornada','actividad')),
  cargo text,
  vigencia daterange NOT NULL,
  creada_en timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (trabajador_id WITH =, finca_id WITH =, vigencia WITH &&)
);

-- Producción individual: declarada → validada → liquidada → pagada. El trabajador nunca define el valor.
CREATE TABLE registro_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL,
  lote_id uuid,
  trabajador_id uuid NOT NULL REFERENCES trabajador(id),
  vinculacion_id uuid NOT NULL REFERENCES vinculacion(id),
  fecha date NOT NULL,
  modalidad text NOT NULL CHECK (modalidad IN ('kg','arroba','jornada','actividad')),
  actividad text,                                            -- descripción cuando la modalidad es por actividad
  cantidad_declarada numeric(14,3) NOT NULL CHECK (cantidad_declarada > 0),
  unidad_declarada_id uuid NOT NULL REFERENCES unidad(id),
  cantidad_validada numeric(14,3) CHECK (cantidad_validada IS NULL OR cantidad_validada >= 0),  -- en la unidad de la modalidad
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','validado','rechazado','liquidado')),
  tarifa_version_id uuid REFERENCES tarifa_version(id),
  valor_unitario_aplicado numeric(14,2),
  valor_calculado numeric(14,2),
  validado_por uuid REFERENCES usuario(id),
  validado_en timestamptz,
  motivo_rechazo text,
  clave_idempotencia text UNIQUE,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (finca_id) REFERENCES finca(id),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  CHECK (estado <> 'validado' OR (cantidad_validada IS NOT NULL AND valor_calculado IS NOT NULL AND tarifa_version_id IS NOT NULL)),
  CHECK (estado <> 'rechazado' OR motivo_rechazo IS NOT NULL)
);
CREATE INDEX registro_trabajo_trabajador ON registro_trabajo (trabajador_id, fecha);

CREATE TABLE anticipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  trabajador_id uuid NOT NULL REFERENCES trabajador(id),
  fecha date NOT NULL,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  descontado numeric(14,2) NOT NULL DEFAULT 0,
  clave_idempotencia text UNIQUE,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  nota text,
  CHECK (descontado >= 0 AND descontado <= monto)
);

CREATE TABLE liquidacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  trabajador_id uuid NOT NULL REFERENCES trabajador(id),
  periodo daterange NOT NULL,
  total_bruto numeric(14,2) NOT NULL CHECK (total_bruto >= 0),
  total_anticipos numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_anticipos >= 0),
  neto numeric(14,2) NOT NULL CHECK (neto >= 0),
  pagado numeric(14,2) NOT NULL DEFAULT 0 CHECK (pagado >= 0),
  estado text NOT NULL DEFAULT 'liquidada' CHECK (estado IN ('liquidada','pagada')),
  clave_idempotencia text UNIQUE,
  liquidada_por uuid NOT NULL REFERENCES usuario(id),
  creada_en timestamptz NOT NULL DEFAULT now(),
  CHECK (pagado <= neto),
  CHECK (neto = total_bruto - total_anticipos)
);

CREATE TABLE liquidacion_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id uuid NOT NULL REFERENCES liquidacion(id),
  registro_trabajo_id uuid NOT NULL UNIQUE REFERENCES registro_trabajo(id),   -- un registro se liquida una sola vez
  cantidad_liquidada numeric(14,3) NOT NULL,
  valor_unitario numeric(14,2) NOT NULL,
  valor numeric(14,2) NOT NULL
);

CREATE TABLE liquidacion_anticipo (
  liquidacion_id uuid NOT NULL REFERENCES liquidacion(id),
  anticipo_id uuid NOT NULL REFERENCES anticipo(id),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  PRIMARY KEY (liquidacion_id, anticipo_id)
);

CREATE TABLE pago_trabajador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  liquidacion_id uuid NOT NULL REFERENCES liquidacion(id),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  metodo_pago text NOT NULL,
  fecha date NOT NULL,
  clave_idempotencia text UNIQUE,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Las liquidaciones y los pagos son hechos financieros: no se editan ni se borran.
CREATE TRIGGER pago_trabajador_inmutable BEFORE UPDATE OR DELETE ON pago_trabajador
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();
CREATE TRIGGER liquidacion_detalle_inmutable BEFORE UPDATE OR DELETE ON liquidacion_detalle
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

INSERT INTO permiso (codigo, descripcion) VALUES
  ('trabajador:ver','Consultar trabajadores'),
  ('trabajador:ver_propio','Consultar los propios datos, acumulados, anticipos y saldos'),
  ('trabajador:administrar','Crear trabajadores y vinculaciones'),
  ('trabajo:registrar','Registrar producción o jornadas de trabajadores'),
  ('trabajo:registrar_propio','Registrar la propia producción'),
  ('trabajo:validar','Validar o rechazar registros de producción'),
  ('liquidacion:ver','Consultar liquidaciones'),
  ('liquidacion:crear','Liquidar un período'),
  ('anticipo:registrar','Registrar anticipos a trabajadores'),
  ('pago_trabajador:registrar','Registrar pagos a trabajadores');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r CROSS JOIN permiso p
 WHERE r.codigo = 'administrador' AND p.codigo IN
  ('trabajador:ver','trabajador:administrar','trabajo:registrar','trabajo:validar','liquidacion:ver','liquidacion:crear','anticipo:registrar','pago_trabajador:registrar');

-- El encargado de producción asigna trabajadores y valida cantidades; no toca tarifas ni liquida.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('trabajador:ver','trabajo:registrar','trabajo:validar')
 WHERE r.codigo = 'encargado_produccion';

-- Roles de extensión (prompt §7). Las migraciones siguientes les agregan los permisos de sus módulos.
INSERT INTO rol (codigo, nombre, es_extension) VALUES
  ('supervisor_campo','Supervisor de campo', true),
  ('recolector','Trabajador recolector', true),
  ('responsable_bodega','Responsable de bodega', true),
  ('responsable_financiero','Responsable financiero', true),
  ('auditor','Auditor o usuario de consulta', true);

-- Supervisor: ve trabajadores asignados, registra y valida producción. No fija precios ni liquida.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN
  ('finca:ver','lote:ver','cosecha:ver','trabajador:ver','trabajo:registrar','trabajo:validar','inventario:ver','trazabilidad:ver','reporte:ver')
 WHERE r.codigo = 'supervisor_campo';

-- Recolector: solo lo propio. No toca tarifas, inventario ni ventas, ni ve datos de otros trabajadores.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('lote:ver','trabajador:ver_propio','trabajo:registrar_propio')
 WHERE r.codigo = 'recolector';

-- Responsable financiero: liquidaciones, pagos y anticipos. No cambia cantidades recolectadas ni tarifas.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN
  ('finca:ver','trabajador:ver','liquidacion:ver','liquidacion:crear','anticipo:registrar','pago_trabajador:registrar','pago:ver','pago:registrar','venta:ver','tarifa:ver','reporte:ver')
 WHERE r.codigo = 'responsable_financiero';

-- Responsable de bodega: entradas, traslados, transformaciones, pérdidas y conteos. Sin tarifas laborales.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN
  ('finca:ver','lote:ver','inventario:ver','inventario:ajustar','inventario:trasladar','inventario:transformar','producto:ver','bodega:administrar','trazabilidad:ver')
 WHERE r.codigo = 'responsable_bodega';

-- Auditor: solo consulta. Ningún permiso de creación, modificación ni anulación.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN
  ('finca:ver','lote:ver','cosecha:ver','inventario:ver','producto:ver','cliente:ver','pedido:ver','venta:ver','pago:ver','tarifa:ver',
   'configuracion:ver','auditoria:ver','trazabilidad:ver','reporte:ver','trabajador:ver','liquidacion:ver')
 WHERE r.codigo = 'auditor';
