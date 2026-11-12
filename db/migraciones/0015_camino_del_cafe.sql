-- El camino del café después de recogerlo. El café se recolecta rojo y avanza por estados; en cada uno se puede vender
-- o seguir al siguiente paso:
--   rojo (cereza) → despulpar → en lavado → lavar → húmedo → poner a secar → en secado → terminar secado → seco (pergamino)
--   → trillar → almendra → tostar → tostado → moler → molido (en polvo)
-- "En lavado" y "en secado" son estados del café mientras el paso dura (no se venden); así la bodega muestra en tiempo real
-- cuánto café hay en cada estado. Cada paso es una transformación de inventario del mismo lote: la trazabilidad se conserva.
-- También se dejan equivalencias base de la organización (1 arroba = 12,5 kg; 1 carga = 125 kg) para vender o anotar en
-- esas unidades; cada propietario puede fijar las suyas por finca en Ajustes.

CREATE OR REPLACE FUNCTION preparar_camino_cafe(org uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  kg uuid := (SELECT id FROM unidad WHERE codigo = 'kg');
  demo boolean := (SELECT es_demo FROM organizacion WHERE id = org);
  tipo uuid;
  orden integer := 1;
  paso record;
BEGIN
  -- Estados del café que faltaban.
  INSERT INTO producto (organizacion_id, codigo, nombre, categoria, unidad_id, vendible, es_demo)
  SELECT org, v.codigo, v.nombre, 'cafe', kg, v.vendible, demo
    FROM (VALUES ('PLV', 'Café en lavado', false), ('PSC', 'Café en secado', false), ('MOL', 'Café molido (en polvo)', true)) AS v(codigo, nombre, vendible)
  ON CONFLICT (organizacion_id, codigo) DO NOTHING;
  UPDATE producto SET vendible = false WHERE organizacion_id = org AND codigo IN ('PLV', 'PSC');

  -- El camino del café (un solo flujo, en orden).
  INSERT INTO proceso_tipo (organizacion_id, codigo, nombre, es_demo)
  VALUES (org, 'camino_cafe', 'Camino del café', demo)
  ON CONFLICT (organizacion_id, codigo) DO NOTHING;
  SELECT id INTO tipo FROM proceso_tipo WHERE organizacion_id = org AND codigo = 'camino_cafe';
  IF NOT EXISTS (SELECT 1 FROM proceso_etapa WHERE proceso_tipo_id = tipo) THEN
    FOR paso IN
      SELECT * FROM (VALUES
        ('despulpado', 'Despulpar', 'CER', 'PLV'),
        ('lavado', 'Lavar', 'PLV', 'PHU'),
        ('inicio_secado', 'Poner a secar', 'PHU', 'PSC'),
        ('secado', 'Terminar el secado', 'PSC', 'PSE'),
        ('trilla', 'Trillar', 'PSE', 'EXC'),
        ('tostion', 'Tostar', 'EXC', 'TOS'),
        ('molienda', 'Moler', 'TOS', 'MOL')
      ) AS p(codigo, nombre, entrada, salida)
    LOOP
      INSERT INTO proceso_etapa (proceso_tipo_id, orden, codigo, nombre, producto_entrada_id, producto_salida_id)
      VALUES (tipo, orden, paso.codigo, paso.nombre,
              (SELECT id FROM producto WHERE organizacion_id = org AND codigo = paso.entrada),
              (SELECT id FROM producto WHERE organizacion_id = org AND codigo = paso.salida));
      orden := orden + 1;
    END LOOP;
  END IF;

  -- Equivalencias base de la organización, solo si no tiene ya una para esa unidad.
  INSERT INTO conversion_unidad (organizacion_id, unidad_origen_id, unidad_destino_id, factor, vigencia, es_demo)
  SELECT org, u.id, kg, v.factor, '[2020-01-01,)', demo
    FROM (VALUES ('arroba', 12.5::numeric), ('carga', 125::numeric)) AS v(codigo, factor)
    JOIN unidad u ON u.codigo = v.codigo
   WHERE NOT EXISTS (
     SELECT 1 FROM conversion_unidad c
      WHERE c.organizacion_id = org AND c.finca_id IS NULL AND c.unidad_origen_id = u.id AND c.unidad_destino_id = kg);
END;
$$;

SELECT preparar_camino_cafe(id) FROM organizacion;

-- Los flujos genéricos de la instalación quedan reemplazados por el camino del café (se conservan para el historial).
UPDATE proceso_tipo SET activo = false WHERE codigo IN ('cafe_lavado', 'cafe_natural') AND NOT es_demo;
