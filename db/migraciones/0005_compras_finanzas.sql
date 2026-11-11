-- 0005 · Extensión 3: compras, cuentas por pagar, gastos y finanzas.
-- Los movimientos financieros se separan de los movimientos físicos de inventario. Los comprobantes son internos
-- (no hay facturación electrónica DIAN). Los pagos son hechos inmutables.

CREATE TABLE proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  nombre text NOT NULL,
  documento text,
  telefono text,
  correo text,
  activo boolean NOT NULL DEFAULT true,
  autorizo_tratamiento_en timestamptz,            -- Ley 1581: proveedor persona natural
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, documento),
  UNIQUE (id, organizacion_id)
);

-- Pedido → recepción → cuenta por pagar. El costo queda guardado en cada línea.
CREATE TABLE compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  proveedor_id uuid NOT NULL,
  numero bigint GENERATED ALWAYS AS IDENTITY,
  fecha date NOT NULL,
  estado text NOT NULL DEFAULT 'pedida' CHECK (estado IN ('pedida','recibida')),
  fecha_recepcion date,
  total numeric(14,2) NOT NULL CHECK (total > 0),
  pagado numeric(14,2) NOT NULL DEFAULT 0 CHECK (pagado >= 0),
  clave_idempotencia text NOT NULL,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  recibido_por uuid REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  nota text,
  FOREIGN KEY (proveedor_id, organizacion_id) REFERENCES proveedor(id, organizacion_id),
  UNIQUE (organizacion_id, clave_idempotencia),
  CHECK (pagado <= total),
  CHECK (estado = 'recibida' OR pagado = 0),
  CHECK (estado <> 'recibida' OR fecha_recepcion IS NOT NULL)
);

CREATE TABLE compra_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES compra(id),
  descripcion text NOT NULL,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  unidad text NOT NULL,
  costo_unitario numeric(14,2) NOT NULL CHECK (costo_unitario >= 0),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE pago_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  compra_id uuid NOT NULL REFERENCES compra(id),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  metodo text NOT NULL,
  fecha date NOT NULL,
  clave_idempotencia text NOT NULL,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, clave_idempotencia)
);
CREATE TRIGGER pago_proveedor_inmutable BEFORE UPDATE OR DELETE ON pago_proveedor
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();
CREATE TRIGGER pago_cliente_inmutable BEFORE UPDATE OR DELETE ON pago_cliente
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

-- Gastos administrativos y agrícolas. El tipo es un valor configurable (catalogo_valor: tipo_gasto).
CREATE TABLE gasto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  finca_id uuid NOT NULL REFERENCES finca(id),
  lote_id uuid,
  tipo text NOT NULL,
  clasificacion text NOT NULL CHECK (clasificacion IN ('agricola','administrativo')),
  fecha date NOT NULL,
  descripcion text NOT NULL,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  metodo text,
  clave_idempotencia text NOT NULL,
  registrado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id),
  UNIQUE (organizacion_id, clave_idempotencia)
);
CREATE TRIGGER gasto_inmutable BEFORE UPDATE OR DELETE ON gasto
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion();

INSERT INTO permiso (codigo, descripcion) VALUES
  ('proveedor:ver','Consultar proveedores'),
  ('proveedor:administrar','Crear y modificar proveedores'),
  ('compra:ver','Consultar compras y cuentas por pagar'),
  ('compra:crear','Registrar pedidos de compra'),
  ('compra:recibir','Registrar la recepción de una compra'),
  ('pago_proveedor:registrar','Registrar pagos a proveedores'),
  ('gasto:ver','Consultar gastos'),
  ('gasto:registrar','Registrar gastos administrativos y agrícolas'),
  ('finanzas:ver','Consultar el resumen financiero, la cartera y la conciliación');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN
  ('proveedor:ver','proveedor:administrar','compra:ver','compra:crear','compra:recibir','pago_proveedor:registrar','gasto:ver','gasto:registrar','finanzas:ver')
 WHERE r.codigo IN ('administrador','responsable_financiero');
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('proveedor:ver','compra:ver','gasto:ver','finanzas:ver')
 WHERE r.codigo = 'auditor';
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('proveedor:ver','compra:ver','compra:crear','compra:recibir','gasto:ver','gasto:registrar')
 WHERE r.codigo = 'encargado_produccion';
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('proveedor:ver','compra:ver','compra:recibir')
 WHERE r.codigo = 'responsable_bodega';
