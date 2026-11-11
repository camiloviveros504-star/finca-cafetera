-- 0004 · Extensión 2: beneficio y poscosecha con flujos de proceso configurables por tipo de producto.
-- Cada etapa ejecutada es una transformación de inventario (movimientos inmutables) que conserva el lote de origen.

CREATE TABLE proceso_tipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  codigo text NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  es_demo boolean NOT NULL DEFAULT false,
  creado_por uuid REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, codigo)
);

-- Las etapas, su orden, los productos de entrada/salida y la merma esperada son datos, no código.
CREATE TABLE proceso_etapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_tipo_id uuid NOT NULL REFERENCES proceso_tipo(id),
  orden integer NOT NULL CHECK (orden > 0),
  codigo text NOT NULL,                              -- recibo, despulpado, mucilago, clasificacion, lavado, secado, almacenamiento, transporte, trilla...
  nombre text NOT NULL,
  producto_entrada_id uuid NOT NULL REFERENCES producto(id),
  producto_salida_id uuid NOT NULL REFERENCES producto(id),
  merma_esperada_pct numeric(5,2) CHECK (merma_esperada_pct IS NULL OR (merma_esperada_pct >= 0 AND merma_esperada_pct <= 100)),
  UNIQUE (proceso_tipo_id, orden),
  UNIQUE (proceso_tipo_id, codigo),
  UNIQUE (id, proceso_tipo_id)
);

CREATE TABLE proceso_registro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  proceso_tipo_id uuid NOT NULL REFERENCES proceso_tipo(id),
  proceso_etapa_id uuid NOT NULL REFERENCES proceso_etapa(id),
  transformacion_id uuid NOT NULL UNIQUE REFERENCES transformacion(id),   -- la etapa ES una transformación de inventario
  fecha date NOT NULL,
  entrada_total numeric(14,3) NOT NULL CHECK (entrada_total > 0),
  salida_total numeric(14,3) NOT NULL CHECK (salida_total > 0),
  perdida_total numeric(14,3) NOT NULL CHECK (perdida_total >= 0),
  merma_pct numeric(6,2) NOT NULL,
  merma_excede_esperada boolean NOT NULL DEFAULT false,
  justificacion text,                                -- obligatoria si la merma supera la esperada
  responsable_id uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT merma_excede_esperada OR justificacion IS NOT NULL)
);
CREATE INDEX proceso_registro_finca_fecha ON proceso_registro (finca_id, fecha DESC);

CREATE TRIGGER proceso_registro_inmutable BEFORE UPDATE OR DELETE ON proceso_registro
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

INSERT INTO permiso (codigo, descripcion) VALUES
  ('proceso:ver','Consultar procesos de beneficio y poscosecha'),
  ('proceso:administrar','Configurar flujos de proceso y etapas'),
  ('proceso:registrar','Registrar etapas de beneficio y poscosecha');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('proceso:ver','proceso:administrar','proceso:registrar')
 WHERE r.codigo = 'administrador';
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('proceso:ver','proceso:registrar')
 WHERE r.codigo IN ('encargado_produccion','responsable_bodega');
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('proceso:ver')
 WHERE r.codigo IN ('supervisor_campo','auditor');
