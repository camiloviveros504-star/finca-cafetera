-- 0007 · Anulaciones (con reverso de inventario, nunca borrado), descuentos autorizados y derechos del titular (Ley 1581).

ALTER TABLE venta
  ADD COLUMN anulada_por uuid REFERENCES usuario(id),
  ADD COLUMN anulada_en timestamptz,
  ADD COLUMN motivo_anulacion text,
  ADD CONSTRAINT venta_anulacion_completa CHECK (estado <> 'anulada' OR (anulada_por IS NOT NULL AND anulada_en IS NOT NULL AND motivo_anulacion IS NOT NULL));

ALTER TABLE cosecha
  ADD COLUMN anulada_por uuid REFERENCES usuario(id),
  ADD COLUMN anulada_en timestamptz,
  ADD COLUMN motivo_anulacion text,
  ADD CONSTRAINT cosecha_anulacion_completa CHECK (estado <> 'anulada' OR (anulada_por IS NOT NULL AND anulada_en IS NOT NULL AND motivo_anulacion IS NOT NULL));

-- Supresión de datos personales: se anonimizan los campos personales y se conserva el registro (las ventas y
-- liquidaciones son hechos económicos que deben seguir siendo consistentes).
ALTER TABLE cliente ADD COLUMN anonimizado_en timestamptz;
ALTER TABLE trabajador ADD COLUMN anonimizado_en timestamptz;

INSERT INTO permiso (codigo, descripcion) VALUES
  ('venta:descontar','Aplicar descuentos autorizados en una venta (hasta el máximo configurado)'),
  ('datos_personales:gestionar','Atender solicitudes de los titulares: consulta, rectificación y supresión (Ley 1581)');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN ('venta:descontar','datos_personales:gestionar') WHERE r.codigo = 'administrador';
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo = 'venta:descontar' WHERE r.codigo = 'responsable_comercial';
