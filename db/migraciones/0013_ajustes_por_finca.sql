-- Los ajustes son de la operación de cada finca, no de la plataforma:
--   · métodos de pago y tipos de gasto: una base del sistema (finca_id NULL, creada en la instalación, no editable) más los
--     valores que cada propietario agrega para su finca. Lo que agrega un dueño no lo ven los demás.
--   · equivalencias de unidades y parámetros ya admitían finca; desde ahora el propietario solo los fija para sus fincas.
-- Se eliminan los ajustes que ningún módulo usaba (otros catálogos, temporadas y el parámetro de existencias mínimas).
-- El administrador de la plataforma deja de tener permisos de configuración.

ALTER TABLE catalogo_valor ADD COLUMN finca_id uuid REFERENCES finca(id);
ALTER TABLE catalogo_valor DROP CONSTRAINT catalogo_valor_organizacion_id_catalogo_codigo_key;
CREATE UNIQUE INDEX catalogo_valor_unico ON catalogo_valor
  (organizacion_id, catalogo, codigo, COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid));

DELETE FROM catalogo_valor WHERE catalogo NOT IN ('metodo_pago', 'tipo_gasto');
ALTER TABLE catalogo_valor ADD CONSTRAINT catalogo_valor_catalogo_check CHECK (catalogo IN ('metodo_pago', 'tipo_gasto'));

-- Las temporadas no las usaba ningún módulo; dos columnas las referenciaban sin uso y se quitan con la tabla.
ALTER TABLE tarifa DROP COLUMN temporada_id;
ALTER TABLE proyeccion_cosecha DROP COLUMN temporada_id;
DROP TABLE temporada;
DELETE FROM parametro WHERE clave = 'stock_minimo_kg';

DELETE FROM rol_permiso rp USING rol r, permiso p
 WHERE rp.rol_id = r.id AND rp.permiso_id = p.id AND r.codigo = 'administrador' AND p.codigo IN ('configuracion:ver', 'configuracion:modificar');
