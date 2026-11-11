-- 0002 · Catálogo de permisos y roles originales del Driver.
-- Los permisos viven en la base de datos (no en el código) y se comprueban en el servidor.

INSERT INTO permiso (codigo, descripcion) VALUES
  ('finca:ver','Consultar fincas'),
  ('finca:administrar','Crear y modificar fincas'),
  ('lote:ver','Consultar lotes'),
  ('lote:administrar','Crear y modificar lotes'),
  ('cosecha:ver','Consultar cosechas'),
  ('cosecha:registrar','Registrar cosechas'),
  ('cosecha:anular','Anular cosechas (con reverso de inventario)'),
  ('inventario:ver','Consultar existencias y movimientos'),
  ('inventario:ajustar','Registrar ajustes, pérdidas y conteos físicos'),
  ('inventario:trasladar','Trasladar entre bodegas'),
  ('inventario:transformar','Registrar transformaciones'),
  ('inventario:reversar','Reversar movimientos confirmados'),
  ('producto:ver','Consultar productos'),
  ('producto:administrar','Crear y modificar productos'),
  ('bodega:administrar','Crear y modificar bodegas'),
  ('cliente:ver','Consultar clientes'),
  ('cliente:administrar','Crear y modificar clientes'),
  ('pedido:ver','Consultar pedidos'),
  ('pedido:crear','Registrar pedidos'),
  ('venta:ver','Consultar ventas'),
  ('venta:crear','Registrar ventas'),
  ('venta:anular','Anular ventas'),
  ('pago:ver','Consultar pagos de clientes'),
  ('pago:registrar','Registrar pagos de clientes'),
  ('tarifa:ver','Consultar tarifas'),
  ('tarifa:modificar','Crear versiones de tarifas'),
  ('configuracion:ver','Consultar configuración'),
  ('configuracion:modificar','Modificar configuración, unidades y equivalencias'),
  ('usuario:ver','Consultar usuarios'),
  ('usuario:administrar','Crear usuarios y asignar roles'),
  ('auditoria:ver','Consultar la auditoría'),
  ('trazabilidad:ver','Consultar la trazabilidad de una venta o lote'),
  ('reporte:ver','Consultar reportes');

INSERT INTO rol (codigo, nombre, es_extension) VALUES
  ('administrador','Administrador', false),
  ('encargado_produccion','Encargado de producción', false),
  ('responsable_comercial','Responsable comercial', false);

-- Administrador: todos los permisos del núcleo.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r CROSS JOIN permiso p WHERE r.codigo = 'administrador';

-- Encargado de producción: lotes, cosechas, pérdidas y consulta de producción. Sin tarifas ni permisos globales.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN (
  'finca:ver','lote:ver','lote:administrar','cosecha:ver','cosecha:registrar',
  'inventario:ver','inventario:ajustar','inventario:transformar','producto:ver',
  'trazabilidad:ver','reporte:ver')
WHERE r.codigo = 'encargado_produccion';

-- Responsable comercial: clientes, pedidos, ventas y pagos. Sin ajustes ni reversos de inventario.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN (
  'finca:ver','cliente:ver','cliente:administrar','pedido:ver','pedido:crear',
  'venta:ver','venta:crear','pago:ver','pago:registrar','inventario:ver','producto:ver',
  'tarifa:ver','trazabilidad:ver','reporte:ver')
WHERE r.codigo = 'responsable_comercial';

-- Unidades base (no son valores comerciales). Las equivalencias van por organización con vigencia.
INSERT INTO unidad (codigo, nombre, tipo) VALUES
  ('kg','Kilogramo','masa'),
  ('arroba','Arroba','masa'),
  ('carga','Carga','masa'),
  ('saco','Saco','masa'),
  ('jornada','Jornada','tiempo');
