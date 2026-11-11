-- 0009 · Reestructura orientada al control de una finca:
--  · cuatro roles visibles (administrador, propietario, capataz, trabajador); los roles granulares anteriores quedan ocultos
--  · tipos de café (cereza, húmedo, seco, pasilla, plumilla, almendra, tostado)
--  · ciclo del lote (sin sembrar → sembrado → zoca → tumba y resiembra) con historial
--  · insumos con presentación (bulto de X gramos), compras que alimentan el inventario y aplicaciones por gramos por árbol
--  · venta con precio propio, variedad, taza y destino; fletes y otros gastos ligados a una venta
--  · datos propios de cada finca (compradores, proveedores, insumos)

-- ───────────── Roles ─────────────
ALTER TABLE rol ADD COLUMN visible boolean NOT NULL DEFAULT true;
UPDATE rol SET visible = false WHERE codigo <> 'administrador';   -- roles granulares heredados: ocultos, no se ofrecen al crear cuentas

INSERT INTO rol (codigo, nombre, es_extension, visible) VALUES
  ('propietario','Propietario o administrador de finca', false, true),
  ('capataz','Capataz', false, true),
  ('trabajador','Trabajador', false, true);

INSERT INTO permiso (codigo, descripcion) VALUES ('usuario:invitar_equipo','Invitar capataces y trabajadores a sus propias fincas');

-- El administrador de la plataforma conserva todos los permisos.
INSERT INTO rol_permiso (rol_id, permiso_id) SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo = 'usuario:invitar_equipo' WHERE r.codigo = 'administrador';

-- Propietario: control total de SUS fincas (lotes, insumos, trabajadores, producción, ventas, gastos). No crea fincas ni administra cuentas globales.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r CROSS JOIN permiso p
 WHERE r.codigo = 'propietario' AND p.codigo NOT IN ('usuario:administrar','finca:administrar','auditoria:ver');

-- Capataz: maneja al personal en fincas grandes (recolección, labores, aplicaciones). Sin ventas, pagos ni tarifas.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo IN
  ('finca:ver','lote:ver','cosecha:ver','cosecha:registrar','trabajador:ver','trabajo:registrar','trabajo:validar','inventario:ver','producto:ver',
   'agroquimico:ver','aplicacion:registrar','inspeccion:ver','inspeccion:registrar','planificacion:ver','planificacion:administrar',
   'equipo:ver','equipo:registrar_uso','proceso:ver','proceso:registrar','trazabilidad:ver','reporte:ver')
 WHERE r.codigo = 'capataz';

-- Trabajador: solo consulta sus propios kilos, pagos, anticipos y saldos.
INSERT INTO rol_permiso (rol_id, permiso_id) SELECT r.id, p.id FROM rol r JOIN permiso p ON p.codigo = 'trabajador:ver_propio' WHERE r.codigo = 'trabajador';

-- ───────────── Tipos de café ─────────────
UPDATE producto SET nombre = 'Café rojo sin despulpar (cereza)' WHERE codigo = 'CER' AND NOT es_demo;
UPDATE producto SET nombre = 'Café húmedo o mojado' WHERE codigo = 'PHU' AND NOT es_demo;
UPDATE producto SET nombre = 'Café seco (pergamino)' WHERE codigo = 'PSE' AND NOT es_demo;
UPDATE producto SET nombre = 'Café en almendra' WHERE codigo = 'EXC' AND NOT es_demo;
UPDATE producto SET vendible = true;
INSERT INTO producto (organizacion_id, codigo, nombre, categoria, unidad_id, vendible, es_demo)
SELECT o.id, v.codigo, v.nombre, 'cafe', (SELECT id FROM unidad WHERE codigo = 'kg'), true, o.es_demo
  FROM organizacion o CROSS JOIN (VALUES ('PAS','Pasilla'), ('PLU','Plumilla'), ('TOS','Café tostado')) AS v(codigo, nombre)
ON CONFLICT (organizacion_id, codigo) DO NOTHING;

-- ───────────── Ciclo del lote ─────────────
ALTER TABLE lote DROP CONSTRAINT lote_estado_productivo_check;
ALTER TABLE lote ADD CONSTRAINT lote_estado_productivo_check CHECK (estado_productivo IN ('sin_sembrar','levante','produccion','zoca','renovacion','inactivo'));
ALTER TABLE lote ALTER COLUMN estado_productivo SET DEFAULT 'sin_sembrar';
ALTER TABLE lote ADD COLUMN fecha_ultima_zoca date;

CREATE TABLE lote_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  lote_id uuid NOT NULL REFERENCES lote(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('siembra','zoca','tumba','resiembra','observacion')),
  arboles integer CHECK (arboles IS NULL OR arboles >= 0),
  detalle text,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lote_evento_lote ON lote_evento (lote_id, fecha DESC);

-- Recomendaciones de manejo por edad del cultivo (editables por la organización; con su fuente).
CREATE TABLE recomendacion_cultivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  etapa text NOT NULL CHECK (etapa IN ('levante','produccion','renovacion')),
  edad_desde_meses integer NOT NULL CHECK (edad_desde_meses >= 0),
  edad_hasta_meses integer,
  labor text NOT NULL CHECK (labor IN ('abonada','renovacion','fumigacion','plateo','otra')),
  titulo text NOT NULL,
  detalle text NOT NULL,
  gramos_por_planta numeric(10,2) CHECK (gramos_por_planta IS NULL OR gramos_por_planta > 0),
  fuente text NOT NULL
);

-- ───────────── Insumos con presentación y datos por finca ─────────────
ALTER TABLE agroquimico
  ADD COLUMN tipo text NOT NULL DEFAULT 'fertilizante' CHECK (tipo IN ('fertilizante','fumigante','herbicida','herramienta','otro')),
  ADD COLUMN gramos_por_unidad numeric(14,3) CHECK (gramos_por_unidad IS NULL OR gramos_por_unidad > 0),   -- p. ej. un bulto de 50.000 g
  ADD COLUMN finca_id uuid REFERENCES finca(id);                                                           -- NULL = compartido de la organización
ALTER TABLE agroquimico_stock ALTER COLUMN vencimiento DROP NOT NULL;                                      -- los fertilizantes no siempre tienen vencimiento
ALTER TABLE aplicacion_agroquimica ADD COLUMN gramos_por_arbol numeric(14,3), ADD COLUMN arboles integer;
ALTER TABLE compra_detalle ADD COLUMN insumo_id uuid REFERENCES agroquimico(id);                           -- la compra recibida acredita este insumo

ALTER TABLE cliente ADD COLUMN finca_id uuid REFERENCES finca(id);
ALTER TABLE proveedor ADD COLUMN finca_id uuid REFERENCES finca(id);

-- ───────────── Venta con precio propio, y gastos ligados a una venta ─────────────
ALTER TABLE venta ADD COLUMN variedad text, ADD COLUMN taza text, ADD COLUMN destino text;
ALTER TABLE gasto ADD COLUMN venta_id uuid REFERENCES venta(id);

INSERT INTO catalogo_valor (organizacion_id, catalogo, codigo, nombre)
SELECT o.id, 'tipo_gasto', v.codigo, v.nombre
  FROM organizacion o CROSS JOIN (VALUES
    ('flete','Flete (transporte de café)'), ('jornales','Jornales y mano de obra'), ('fertilizacion','Fertilización'),
    ('fumigacion','Fumigación'), ('servicios','Servicios y otros pagos')) AS v(codigo, nombre)
ON CONFLICT (organizacion_id, catalogo, codigo) DO NOTHING;

-- ───────────── Labores de trabajadores con valor propio ─────────────
ALTER TABLE registro_trabajo ADD COLUMN labor text, ADD COLUMN valor_manual boolean NOT NULL DEFAULT false;
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'registro_trabajo'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%tarifa_version_id IS NOT NULL%' LOOP
    EXECUTE format('ALTER TABLE registro_trabajo DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
-- Un registro validado necesita su valor; viene de la tarifa vigente o lo fijó quien validó (propietario o capataz).
ALTER TABLE registro_trabajo ADD CONSTRAINT registro_trabajo_validado_completo
  CHECK (estado <> 'validado' OR (cantidad_validada IS NOT NULL AND valor_calculado IS NOT NULL AND (tarifa_version_id IS NOT NULL OR valor_manual)));

-- Recomendaciones iniciales para las organizaciones existentes (las nuevas las crea la instalación). Fuentes: Cenicafé.
-- Dosis de la etapa de levante: 58 g de nitrógeno por planta en 18 meses, en cinco aplicaciones (7, 9, 12, 14 y 16 g).
-- En producción NO se fija una dosis: depende del análisis de suelo y la producción esperada (se deja para que el dueño la defina).
INSERT INTO recomendacion_cultivo (organizacion_id, etapa, edad_desde_meses, edad_hasta_meses, labor, titulo, detalle, gramos_por_planta, fuente)
SELECT o.id, v.etapa, v.desde, v.hasta, v.labor, v.titulo, v.detalle, v.gramos, v.fuente
  FROM organizacion o CROSS JOIN (VALUES
    ('levante', 2, 2, 'abonada', 'Primera abonada (mes 2)', 'Fertilizante con nitrógeno alrededor del árbol, al comenzar un período de lluvias.', 7.00, 'Cenicafé: 58 g de nitrógeno por planta en 18 meses (7, 9, 12, 14 y 16 g)'),
    ('levante', 6, 6, 'abonada', 'Segunda abonada (mes 6)', 'Fertilizante con nitrógeno, al comenzar un período de lluvias.', 9.00, 'Cenicafé: 58 g de nitrógeno por planta en 18 meses (7, 9, 12, 14 y 16 g)'),
    ('levante', 10, 10, 'abonada', 'Tercera abonada (mes 10)', 'Fertilizante con nitrógeno, al comenzar un período de lluvias.', 12.00, 'Cenicafé: 58 g de nitrógeno por planta en 18 meses (7, 9, 12, 14 y 16 g)'),
    ('levante', 14, 14, 'abonada', 'Cuarta abonada (mes 14)', 'Fertilizante con nitrógeno, al comenzar un período de lluvias.', 14.00, 'Cenicafé: 58 g de nitrógeno por planta en 18 meses (7, 9, 12, 14 y 16 g)'),
    ('levante', 18, 18, 'abonada', 'Quinta abonada (mes 18)', 'Fertilizante con nitrógeno, al comenzar un período de lluvias.', 16.00, 'Cenicafé: 58 g de nitrógeno por planta en 18 meses (7, 9, 12, 14 y 16 g)'),
    ('produccion', 24, 59, 'abonada', 'Abonada anual en producción', 'Fertilice al comenzar cada período de lluvias. El nitrógeno es el nutriente más limitante; la dosis la define su análisis de suelo y la producción esperada. Registre aquí la dosis que adopte.', NULL, 'Cenicafé: fertilizar al comenzar los períodos lluviosos; dosis según análisis de suelo'),
    ('renovacion', 60, NULL, 'renovacion', 'Evaluar la renovación (año 5 o 6)', 'Hacia el quinto o sexto año, con 4 o 5 cosechas, el cafetal llega a la edad de renovación. Opciones: zoca (corte a unos 30 cm; más económica y rinde otras 4 o 5 cosechas) o tumbar y resembrar (permite ajustar la densidad). La zoca se hace en período seco y con cosecha sanitaria previa.', NULL, 'Cenicafé, Avances Técnicos sobre renovación de cafetales')
  ) AS v(etapa, desde, hasta, labor, titulo, detalle, gramos, fuente);
