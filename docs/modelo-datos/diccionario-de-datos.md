# Diccionario de datos

> Generado con `npx tsx db/diccionario.ts` desde el esquema real de PostgreSQL. No se edita a mano.

Tablas: 60. Montos `numeric(14,2)`, cantidades `numeric(14,3)`, fechas `timestamptz`, claves primarias `uuid`.

## actividad_programada

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| lote_id | uuid | sí |  |
| tipo | text | no |  |
| titulo | text | no |  |
| fecha_programada | date | no |  |
| estado | text | no | `'programada'::text` |
| fecha_cierre | date | sí |  |
| resultado | text | sí |  |
| clave_idempotencia | text | no |  |
| creado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `actividad_programada_check`: CHECK (((estado = 'programada'::text) OR (fecha_cierre IS NOT NULL)))
- `actividad_programada_estado_check`: CHECK ((estado = ANY (ARRAY['programada'::text, 'completada'::text, 'cancelada'::text])))
- `actividad_programada_tipo_check`: CHECK ((tipo = ANY (ARRAY['floracion'::text, 'fertilizacion'::text, 'sombrio'::text, 'arvenses'::text, 'plagas'::text, 'enfermedades'::text, 'renovacion'::text, 'cosecha'::text, 'otra'::text])))
- `actividad_programada_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `actividad_programada_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `actividad_programada_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `actividad_programada_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `actividad_programada_pkey`: PRIMARY KEY (id)
- `actividad_programada_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## agroquimico

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| nombre | text | no |  |
| unidad | text | no |  |
| carencia_dias | integer | sí |  |
| activo | boolean | no | `true` |

Restricciones:

- `agroquimico_carencia_dias_check`: CHECK (((carencia_dias IS NULL) OR (carencia_dias >= 0)))
- `agroquimico_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `agroquimico_pkey`: PRIMARY KEY (id)
- `agroquimico_organizacion_id_nombre_key`: UNIQUE (organizacion_id, nombre)

## agroquimico_movimiento

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| stock_id | uuid | no |  |
| tipo | text | no |  |
| delta | numeric(14,3) | no |  |
| origen_id | uuid | sí |  |
| creado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |
| nota | text | sí |  |

Restricciones:

- `agroquimico_movimiento_delta_check`: CHECK ((delta <> (0)::numeric))
- `agroquimico_movimiento_tipo_check`: CHECK ((tipo = ANY (ARRAY['entrada'::text, 'aplicacion'::text, 'baja'::text])))
- `agroquimico_movimiento_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `agroquimico_movimiento_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `agroquimico_movimiento_stock_id_fkey`: FOREIGN KEY (stock_id) REFERENCES agroquimico_stock(id)
- `agroquimico_movimiento_pkey`: PRIMARY KEY (id)

## agroquimico_stock

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| agroquimico_id | uuid | no |  |
| lote_comercial | text | no |  |
| vencimiento | date | no |  |
| cantidad | numeric(14,3) | no |  |

Restricciones:

- `agroquimico_stock_cantidad_check`: CHECK ((cantidad >= (0)::numeric))
- `agroquimico_stock_agroquimico_id_fkey`: FOREIGN KEY (agroquimico_id) REFERENCES agroquimico(id)
- `agroquimico_stock_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `agroquimico_stock_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `agroquimico_stock_pkey`: PRIMARY KEY (id)
- `agroquimico_stock_finca_id_agroquimico_id_lote_comercial_key`: UNIQUE (finca_id, agroquimico_id, lote_comercial)

## anticipo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| trabajador_id | uuid | no |  |
| fecha | date | no |  |
| monto | numeric(14,2) | no |  |
| descontado | numeric(14,2) | no | `0` |
| clave_idempotencia | text | sí |  |
| registrado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |
| nota | text | sí |  |

Restricciones:

- `anticipo_check`: CHECK (((descontado >= (0)::numeric) AND (descontado <= monto)))
- `anticipo_monto_check`: CHECK ((monto > (0)::numeric))
- `anticipo_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `anticipo_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `anticipo_trabajador_id_fkey`: FOREIGN KEY (trabajador_id) REFERENCES trabajador(id)
- `anticipo_pkey`: PRIMARY KEY (id)
- `anticipo_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

## aplicacion_agroquimica

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| lote_id | uuid | no |  |
| stock_id | uuid | no |  |
| fecha | date | no |  |
| dosis | numeric(14,3) | no |  |
| unidad_dosis | text | no |  |
| cantidad_total | numeric(14,3) | no |  |
| fecha_reingreso | date | sí |  |
| inspeccion_id | uuid | sí |  |
| responsable_id | uuid | no |  |
| clave_idempotencia | text | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `aplicacion_agroquimica_cantidad_total_check`: CHECK ((cantidad_total > (0)::numeric))
- `aplicacion_agroquimica_dosis_check`: CHECK ((dosis > (0)::numeric))
- `aplicacion_agroquimica_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `aplicacion_agroquimica_inspeccion_id_fkey`: FOREIGN KEY (inspeccion_id) REFERENCES inspeccion(id)
- `aplicacion_agroquimica_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `aplicacion_agroquimica_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `aplicacion_agroquimica_responsable_id_fkey`: FOREIGN KEY (responsable_id) REFERENCES usuario(id)
- `aplicacion_agroquimica_stock_id_fkey`: FOREIGN KEY (stock_id) REFERENCES agroquimico_stock(id)
- `aplicacion_agroquimica_pkey`: PRIMARY KEY (id)
- `aplicacion_agroquimica_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## auditoria

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | bigint | no | `nextval('auditoria_id_seq'::regclass)` |
| organizacion_id | uuid | sí |  |
| usuario_id | uuid | sí |  |
| accion | text | no |  |
| entidad | text | no |  |
| entidad_id | text | sí |  |
| resultado | text | no |  |
| antes | jsonb | sí |  |
| despues | jsonb | sí |  |
| ip | text | sí |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `auditoria_resultado_check`: CHECK ((resultado = ANY (ARRAY['ok'::text, 'denegado'::text, 'error'::text])))
- `auditoria_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE INDEX auditoria_entidad_idx ON public.auditoria USING btree (entidad, entidad_id)`
- `CREATE INDEX auditoria_org_fecha_idx ON public.auditoria USING btree (organizacion_id, creado_en DESC)`

## bodega

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| nombre | text | no |  |

Restricciones:

- `bodega_finca_id_organizacion_id_fkey`: FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id)
- `bodega_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `bodega_pkey`: PRIMARY KEY (id)
- `bodega_finca_id_nombre_key`: UNIQUE (finca_id, nombre)
- `bodega_id_finca_id_key`: UNIQUE (id, finca_id)

## catalogo_valor

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| catalogo | text | no |  |
| codigo | text | no |  |
| nombre | text | no |  |
| activo | boolean | no | `true` |

Restricciones:

- `catalogo_valor_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `catalogo_valor_pkey`: PRIMARY KEY (id)
- `catalogo_valor_organizacion_id_catalogo_codigo_key`: UNIQUE (organizacion_id, catalogo, codigo)

## cliente

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| nombre | text | no |  |
| documento | text | sí |  |
| telefono | text | sí |  |
| correo | text | sí |  |
| direccion | text | sí |  |
| finalidad_tratamiento | text | no | `'Gestión comercial y cartera de ventas de café'::text` |
| autorizo_tratamiento_en | timestamp with time zone | sí |  |
| activo | boolean | no | `true` |
| creado_en | timestamp with time zone | no | `now()` |
| anonimizado_en | timestamp with time zone | sí |  |

Restricciones:

- `cliente_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `cliente_pkey`: PRIMARY KEY (id)
- `cliente_id_organizacion_id_key`: UNIQUE (id, organizacion_id)

Índices:

- `CREATE INDEX cliente_org_nombre_idx ON public.cliente USING btree (organizacion_id, lower(nombre))`

## compra

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| proveedor_id | uuid | no |  |
| numero | bigint | no |  |
| fecha | date | no |  |
| estado | text | no | `'pedida'::text` |
| fecha_recepcion | date | sí |  |
| total | numeric(14,2) | no |  |
| pagado | numeric(14,2) | no | `0` |
| clave_idempotencia | text | no |  |
| creado_por | uuid | no |  |
| recibido_por | uuid | sí |  |
| creado_en | timestamp with time zone | no | `now()` |
| nota | text | sí |  |

Restricciones:

- `compra_check`: CHECK ((pagado <= total))
- `compra_check1`: CHECK (((estado = 'recibida'::text) OR (pagado = (0)::numeric)))
- `compra_check2`: CHECK (((estado <> 'recibida'::text) OR (fecha_recepcion IS NOT NULL)))
- `compra_estado_check`: CHECK ((estado = ANY (ARRAY['pedida'::text, 'recibida'::text])))
- `compra_pagado_check`: CHECK ((pagado >= (0)::numeric))
- `compra_total_check`: CHECK ((total > (0)::numeric))
- `compra_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `compra_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `compra_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `compra_proveedor_id_organizacion_id_fkey`: FOREIGN KEY (proveedor_id, organizacion_id) REFERENCES proveedor(id, organizacion_id)
- `compra_recibido_por_fkey`: FOREIGN KEY (recibido_por) REFERENCES usuario(id)
- `compra_pkey`: PRIMARY KEY (id)
- `compra_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## compra_detalle

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| compra_id | uuid | no |  |
| descripcion | text | no |  |
| cantidad | numeric(14,3) | no |  |
| unidad | text | no |  |
| costo_unitario | numeric(14,2) | no |  |
| subtotal | numeric(14,2) | no |  |

Restricciones:

- `compra_detalle_cantidad_check`: CHECK ((cantidad > (0)::numeric))
- `compra_detalle_costo_unitario_check`: CHECK ((costo_unitario >= (0)::numeric))
- `compra_detalle_subtotal_check`: CHECK ((subtotal >= (0)::numeric))
- `compra_detalle_compra_id_fkey`: FOREIGN KEY (compra_id) REFERENCES compra(id)
- `compra_detalle_pkey`: PRIMARY KEY (id)

## conversion_unidad

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | sí |  |
| unidad_origen_id | uuid | no |  |
| unidad_destino_id | uuid | no |  |
| factor | numeric(18,6) | no |  |
| vigencia | daterange | no |  |
| es_demo | boolean | no | `false` |
| creada_por | uuid | sí |  |
| creada_en | timestamp with time zone | no | `now()` |

Restricciones:

- `conversion_unidad_check`: CHECK ((unidad_origen_id <> unidad_destino_id))
- `conversion_unidad_factor_check`: CHECK ((factor > (0)::numeric))
- `conversion_unidad_creada_por_fkey`: FOREIGN KEY (creada_por) REFERENCES usuario(id)
- `conversion_unidad_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `conversion_unidad_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `conversion_unidad_unidad_destino_id_fkey`: FOREIGN KEY (unidad_destino_id) REFERENCES unidad(id)
- `conversion_unidad_unidad_origen_id_fkey`: FOREIGN KEY (unidad_origen_id) REFERENCES unidad(id)
- `conversion_unidad_pkey`: PRIMARY KEY (id)
- `conversion_unidad_organizacion_id_coalesce_unidad_origen_i_excl`: EXCLUDE USING gist (organizacion_id WITH =, COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, unidad_origen_id WITH =, unidad_destino_id WITH =, vigencia WITH &&)

## cosecha

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| lote_id | uuid | no |  |
| producto_id | uuid | no |  |
| bodega_id | uuid | no |  |
| fecha | date | no |  |
| cantidad | numeric(14,3) | no |  |
| unidad_id | uuid | no |  |
| cantidad_base | numeric(14,3) | no |  |
| factor_aplicado | numeric(18,6) | no |  |
| estado | text | no | `'confirmada'::text` |
| clave_idempotencia | uuid | no |  |
| capturada_en | timestamp with time zone | no |  |
| recibida_en | timestamp with time zone | no | `now()` |
| registrado_por | uuid | no |  |
| nota | text | sí |  |
| anulada_por | uuid | sí |  |
| anulada_en | timestamp with time zone | sí |  |
| motivo_anulacion | text | sí |  |

Restricciones:

- `cosecha_anulacion_completa`: CHECK (((estado <> 'anulada'::text) OR ((anulada_por IS NOT NULL) AND (anulada_en IS NOT NULL) AND (motivo_anulacion IS NOT NULL))))
- `cosecha_cantidad_base_check`: CHECK ((cantidad_base > (0)::numeric))
- `cosecha_cantidad_check`: CHECK ((cantidad > (0)::numeric))
- `cosecha_estado_check`: CHECK ((estado = ANY (ARRAY['confirmada'::text, 'anulada'::text])))
- `cosecha_factor_aplicado_check`: CHECK ((factor_aplicado > (0)::numeric))
- `cosecha_anulada_por_fkey`: FOREIGN KEY (anulada_por) REFERENCES usuario(id)
- `cosecha_bodega_id_finca_id_fkey`: FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
- `cosecha_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `cosecha_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `cosecha_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `cosecha_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `cosecha_unidad_id_fkey`: FOREIGN KEY (unidad_id) REFERENCES unidad(id)
- `cosecha_pkey`: PRIMARY KEY (id)
- `cosecha_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

Índices:

- `CREATE INDEX cosecha_finca_fecha_idx ON public.cosecha USING btree (finca_id, fecha DESC)`
- `CREATE INDEX cosecha_lote_fecha_idx ON public.cosecha USING btree (lote_id, fecha DESC)`

## equipo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| tipo | text | no |  |
| codigo | text | no |  |
| nombre | text | no |  |
| estado | text | no | `'activo'::text` |
| intervalo_mantenimiento_dias | integer | sí |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `equipo_estado_check`: CHECK ((estado = ANY (ARRAY['activo'::text, 'en_mantenimiento'::text, 'baja'::text])))
- `equipo_intervalo_mantenimiento_dias_check`: CHECK (((intervalo_mantenimiento_dias IS NULL) OR (intervalo_mantenimiento_dias > 0)))
- `equipo_tipo_check`: CHECK ((tipo = ANY (ARRAY['maquinaria'::text, 'herramienta'::text, 'vehiculo'::text])))
- `equipo_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `equipo_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `equipo_pkey`: PRIMARY KEY (id)
- `equipo_finca_id_codigo_key`: UNIQUE (finca_id, codigo)

## finca

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| nombre | text | no |  |
| ubicacion | text | sí |  |
| area_ha | numeric(10,2) | sí |  |
| activa | boolean | no | `true` |
| creada_en | timestamp with time zone | no | `now()` |

Restricciones:

- `finca_area_ha_check`: CHECK (((area_ha IS NULL) OR (area_ha > (0)::numeric)))
- `finca_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `finca_pkey`: PRIMARY KEY (id)
- `finca_id_organizacion_id_key`: UNIQUE (id, organizacion_id)
- `finca_organizacion_id_nombre_key`: UNIQUE (organizacion_id, nombre)

## gasto

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| lote_id | uuid | sí |  |
| tipo | text | no |  |
| clasificacion | text | no |  |
| fecha | date | no |  |
| descripcion | text | no |  |
| monto | numeric(14,2) | no |  |
| metodo | text | sí |  |
| clave_idempotencia | text | no |  |
| registrado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `gasto_clasificacion_check`: CHECK ((clasificacion = ANY (ARRAY['agricola'::text, 'administrativo'::text])))
- `gasto_monto_check`: CHECK ((monto > (0)::numeric))
- `gasto_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `gasto_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `gasto_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `gasto_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `gasto_pkey`: PRIMARY KEY (id)
- `gasto_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## inspeccion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| lote_id | uuid | sí |  |
| fecha | date | no |  |
| tipo | text | no |  |
| severidad | text | no |  |
| infestacion_pct | numeric(5,2) | sí |  |
| hallazgos | text | no |  |
| acciones | text | sí |  |
| clave_idempotencia | text | no |  |
| inspector_id | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `inspeccion_infestacion_pct_check`: CHECK (((infestacion_pct IS NULL) OR ((infestacion_pct >= (0)::numeric) AND (infestacion_pct <= (100)::numeric))))
- `inspeccion_severidad_check`: CHECK ((severidad = ANY (ARRAY['ninguna'::text, 'baja'::text, 'media'::text, 'alta'::text])))
- `inspeccion_tipo_check`: CHECK ((tipo = ANY (ARRAY['broca'::text, 'roya'::text, 'plaga'::text, 'enfermedad'::text, 'general'::text])))
- `inspeccion_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `inspeccion_inspector_id_fkey`: FOREIGN KEY (inspector_id) REFERENCES usuario(id)
- `inspeccion_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `inspeccion_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `inspeccion_pkey`: PRIMARY KEY (id)
- `inspeccion_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## intento_acceso

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | bigint | no | `nextval('intento_acceso_id_seq'::regclass)` |
| correo_hash | text | no |  |
| ip | text | no |  |
| exitoso | boolean | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `intento_acceso_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE INDEX intento_acceso_correo_idx ON public.intento_acceso USING btree (correo_hash, creado_en DESC)`
- `CREATE INDEX intento_acceso_ip_idx ON public.intento_acceso USING btree (ip, creado_en DESC)`

## liquidacion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| trabajador_id | uuid | no |  |
| periodo | daterange | no |  |
| total_bruto | numeric(14,2) | no |  |
| total_anticipos | numeric(14,2) | no | `0` |
| neto | numeric(14,2) | no |  |
| pagado | numeric(14,2) | no | `0` |
| estado | text | no | `'liquidada'::text` |
| clave_idempotencia | text | sí |  |
| liquidada_por | uuid | no |  |
| creada_en | timestamp with time zone | no | `now()` |

Restricciones:

- `liquidacion_check`: CHECK ((pagado <= neto))
- `liquidacion_check1`: CHECK ((neto = (total_bruto - total_anticipos)))
- `liquidacion_estado_check`: CHECK ((estado = ANY (ARRAY['liquidada'::text, 'pagada'::text])))
- `liquidacion_neto_check`: CHECK ((neto >= (0)::numeric))
- `liquidacion_pagado_check`: CHECK ((pagado >= (0)::numeric))
- `liquidacion_total_anticipos_check`: CHECK ((total_anticipos >= (0)::numeric))
- `liquidacion_total_bruto_check`: CHECK ((total_bruto >= (0)::numeric))
- `liquidacion_liquidada_por_fkey`: FOREIGN KEY (liquidada_por) REFERENCES usuario(id)
- `liquidacion_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `liquidacion_trabajador_id_fkey`: FOREIGN KEY (trabajador_id) REFERENCES trabajador(id)
- `liquidacion_pkey`: PRIMARY KEY (id)
- `liquidacion_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

## liquidacion_anticipo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| liquidacion_id | uuid | no |  |
| anticipo_id | uuid | no |  |
| monto | numeric(14,2) | no |  |

Restricciones:

- `liquidacion_anticipo_monto_check`: CHECK ((monto > (0)::numeric))
- `liquidacion_anticipo_anticipo_id_fkey`: FOREIGN KEY (anticipo_id) REFERENCES anticipo(id)
- `liquidacion_anticipo_liquidacion_id_fkey`: FOREIGN KEY (liquidacion_id) REFERENCES liquidacion(id)
- `liquidacion_anticipo_pkey`: PRIMARY KEY (liquidacion_id, anticipo_id)

## liquidacion_detalle

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| liquidacion_id | uuid | no |  |
| registro_trabajo_id | uuid | no |  |
| cantidad_liquidada | numeric(14,3) | no |  |
| valor_unitario | numeric(14,2) | no |  |
| valor | numeric(14,2) | no |  |

Restricciones:

- `liquidacion_detalle_liquidacion_id_fkey`: FOREIGN KEY (liquidacion_id) REFERENCES liquidacion(id)
- `liquidacion_detalle_registro_trabajo_id_fkey`: FOREIGN KEY (registro_trabajo_id) REFERENCES registro_trabajo(id)
- `liquidacion_detalle_pkey`: PRIMARY KEY (id)
- `liquidacion_detalle_registro_trabajo_id_key`: UNIQUE (registro_trabajo_id)

## lote

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| codigo | text | no |  |
| nombre | text | no |  |
| area_ha | numeric(10,2) | sí |  |
| variedad | text | sí |  |
| numero_arboles | integer | sí |  |
| fecha_siembra | date | sí |  |
| estado_productivo | text | no | `'produccion'::text` |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `lote_area_ha_check`: CHECK (((area_ha IS NULL) OR (area_ha > (0)::numeric)))
- `lote_estado_productivo_check`: CHECK ((estado_productivo = ANY (ARRAY['levante'::text, 'produccion'::text, 'renovacion'::text, 'inactivo'::text])))
- `lote_numero_arboles_check`: CHECK (((numero_arboles IS NULL) OR (numero_arboles >= 0)))
- `lote_finca_id_organizacion_id_fkey`: FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id)
- `lote_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `lote_pkey`: PRIMARY KEY (id)
- `lote_finca_id_codigo_key`: UNIQUE (finca_id, codigo)
- `lote_id_finca_id_key`: UNIQUE (id, finca_id)

## mantenimiento

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| equipo_id | uuid | no |  |
| fecha | date | no |  |
| tipo | text | no |  |
| descripcion | text | no |  |
| costo | numeric(14,2) | no | `0` |
| proximo_en | date | sí |  |
| gasto_id | uuid | sí |  |
| clave_idempotencia | text | no |  |
| registrado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `mantenimiento_costo_check`: CHECK ((costo >= (0)::numeric))
- `mantenimiento_tipo_check`: CHECK ((tipo = ANY (ARRAY['preventivo'::text, 'correctivo'::text, 'calibracion'::text])))
- `mantenimiento_equipo_id_fkey`: FOREIGN KEY (equipo_id) REFERENCES equipo(id)
- `mantenimiento_gasto_id_fkey`: FOREIGN KEY (gasto_id) REFERENCES gasto(id)
- `mantenimiento_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `mantenimiento_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `mantenimiento_pkey`: PRIMARY KEY (id)
- `mantenimiento_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## movimiento_inventario

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| bodega_id | uuid | no |  |
| producto_id | uuid | no |  |
| lote_id | uuid | no |  |
| tipo | text | no |  |
| delta | numeric(14,3) | no |  |
| origen_tipo | text | no |  |
| origen_id | uuid | sí |  |
| revierte_a | uuid | sí |  |
| clave_idempotencia | text | sí |  |
| creado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |
| nota | text | sí |  |

Restricciones:

- `movimiento_inventario_check`: CHECK (((delta <> (0)::numeric) OR (tipo = 'conteo_fisico'::text)))
- `movimiento_inventario_origen_tipo_check`: CHECK ((origen_tipo = ANY (ARRAY['cosecha'::text, 'transformacion'::text, 'venta'::text, 'ajuste'::text, 'traslado'::text, 'reverso'::text, 'manual'::text, 'compra'::text])))
- `movimiento_inventario_tipo_check`: CHECK ((tipo = ANY (ARRAY['existencia_inicial'::text, 'entrada'::text, 'salida'::text, 'ajuste'::text, 'perdida'::text, 'traslado_salida'::text, 'traslado_entrada'::text, 'transformacion_salida'::text, 'transformacion_entrada'::text, 'reserva'::text, 'conteo_fisico'::text, 'reverso'::text])))
- `movimiento_inventario_bodega_id_finca_id_fkey`: FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
- `movimiento_inventario_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `movimiento_inventario_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `movimiento_inventario_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `movimiento_inventario_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `movimiento_inventario_revierte_a_fkey`: FOREIGN KEY (revierte_a) REFERENCES movimiento_inventario(id)
- `movimiento_inventario_pkey`: PRIMARY KEY (id)
- `movimiento_inventario_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

Índices:

- `CREATE INDEX movimiento_finca_fecha_idx ON public.movimiento_inventario USING btree (finca_id, creado_en DESC)`
- `CREATE INDEX movimiento_lote_idx ON public.movimiento_inventario USING btree (lote_id, producto_id, creado_en)`
- `CREATE INDEX movimiento_origen_idx ON public.movimiento_inventario USING btree (origen_tipo, origen_id)`
- `CREATE UNIQUE INDEX movimiento_un_reverso ON public.movimiento_inventario USING btree (revierte_a) WHERE (revierte_a IS NOT NULL)`

## organizacion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| nombre | text | no |  |
| es_demo | boolean | no | `false` |
| creada_en | timestamp with time zone | no | `now()` |

Restricciones:

- `organizacion_pkey`: PRIMARY KEY (id)

## pago_cliente

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| venta_id | uuid | no |  |
| monto | numeric(14,2) | no |  |
| metodo | text | no |  |
| fecha | timestamp with time zone | no | `now()` |
| clave_idempotencia | text | no |  |
| registrado_por | uuid | no |  |

Restricciones:

- `pago_cliente_monto_check`: CHECK ((monto > (0)::numeric))
- `pago_cliente_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `pago_cliente_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `pago_cliente_venta_id_fkey`: FOREIGN KEY (venta_id) REFERENCES venta(id)
- `pago_cliente_pkey`: PRIMARY KEY (id)
- `pago_cliente_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

Índices:

- `CREATE INDEX pago_venta_idx ON public.pago_cliente USING btree (venta_id)`

## pago_proveedor

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| compra_id | uuid | no |  |
| monto | numeric(14,2) | no |  |
| metodo | text | no |  |
| fecha | date | no |  |
| clave_idempotencia | text | no |  |
| registrado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `pago_proveedor_monto_check`: CHECK ((monto > (0)::numeric))
- `pago_proveedor_compra_id_fkey`: FOREIGN KEY (compra_id) REFERENCES compra(id)
- `pago_proveedor_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `pago_proveedor_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `pago_proveedor_pkey`: PRIMARY KEY (id)
- `pago_proveedor_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## pago_trabajador

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| liquidacion_id | uuid | no |  |
| monto | numeric(14,2) | no |  |
| metodo_pago | text | no |  |
| fecha | date | no |  |
| clave_idempotencia | text | sí |  |
| registrado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `pago_trabajador_monto_check`: CHECK ((monto > (0)::numeric))
- `pago_trabajador_liquidacion_id_fkey`: FOREIGN KEY (liquidacion_id) REFERENCES liquidacion(id)
- `pago_trabajador_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `pago_trabajador_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `pago_trabajador_pkey`: PRIMARY KEY (id)
- `pago_trabajador_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

## parametro

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | sí |  |
| clave | text | no |  |
| valor | jsonb | no |  |
| actualizado_por | uuid | sí |  |
| actualizado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `parametro_actualizado_por_fkey`: FOREIGN KEY (actualizado_por) REFERENCES usuario(id)
- `parametro_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `parametro_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `parametro_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE UNIQUE INDEX parametro_unico ON public.parametro USING btree (organizacion_id, COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid), clave)`

## pedido

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| cliente_id | uuid | no |  |
| fecha | date | no | `CURRENT_DATE` |
| estado | text | no | `'abierto'::text` |
| nota | text | sí |  |
| creado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `pedido_estado_check`: CHECK ((estado = ANY (ARRAY['abierto'::text, 'facturado'::text, 'cancelado'::text])))
- `pedido_cliente_id_organizacion_id_fkey`: FOREIGN KEY (cliente_id, organizacion_id) REFERENCES cliente(id, organizacion_id)
- `pedido_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `pedido_finca_id_organizacion_id_fkey`: FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id)
- `pedido_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `pedido_pkey`: PRIMARY KEY (id)
- `pedido_id_organizacion_id_key`: UNIQUE (id, organizacion_id)

## pedido_detalle

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| pedido_id | uuid | no |  |
| producto_id | uuid | no |  |
| cantidad | numeric(14,3) | no |  |

Restricciones:

- `pedido_detalle_cantidad_check`: CHECK ((cantidad > (0)::numeric))
- `pedido_detalle_pedido_id_fkey`: FOREIGN KEY (pedido_id) REFERENCES pedido(id) ON DELETE CASCADE
- `pedido_detalle_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `pedido_detalle_pkey`: PRIMARY KEY (id)

## permiso

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| codigo | text | no |  |
| descripcion | text | no |  |

Restricciones:

- `permiso_pkey`: PRIMARY KEY (id)
- `permiso_codigo_key`: UNIQUE (codigo)

## proceso_etapa

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| proceso_tipo_id | uuid | no |  |
| orden | integer | no |  |
| codigo | text | no |  |
| nombre | text | no |  |
| producto_entrada_id | uuid | no |  |
| producto_salida_id | uuid | no |  |
| merma_esperada_pct | numeric(5,2) | sí |  |

Restricciones:

- `proceso_etapa_merma_esperada_pct_check`: CHECK (((merma_esperada_pct IS NULL) OR ((merma_esperada_pct >= (0)::numeric) AND (merma_esperada_pct <= (100)::numeric))))
- `proceso_etapa_orden_check`: CHECK ((orden > 0))
- `proceso_etapa_proceso_tipo_id_fkey`: FOREIGN KEY (proceso_tipo_id) REFERENCES proceso_tipo(id)
- `proceso_etapa_producto_entrada_id_fkey`: FOREIGN KEY (producto_entrada_id) REFERENCES producto(id)
- `proceso_etapa_producto_salida_id_fkey`: FOREIGN KEY (producto_salida_id) REFERENCES producto(id)
- `proceso_etapa_pkey`: PRIMARY KEY (id)
- `proceso_etapa_id_proceso_tipo_id_key`: UNIQUE (id, proceso_tipo_id)
- `proceso_etapa_proceso_tipo_id_codigo_key`: UNIQUE (proceso_tipo_id, codigo)
- `proceso_etapa_proceso_tipo_id_orden_key`: UNIQUE (proceso_tipo_id, orden)

## proceso_registro

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| proceso_tipo_id | uuid | no |  |
| proceso_etapa_id | uuid | no |  |
| transformacion_id | uuid | no |  |
| fecha | date | no |  |
| entrada_total | numeric(14,3) | no |  |
| salida_total | numeric(14,3) | no |  |
| perdida_total | numeric(14,3) | no |  |
| merma_pct | numeric(6,2) | no |  |
| merma_excede_esperada | boolean | no | `false` |
| justificacion | text | sí |  |
| responsable_id | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `proceso_registro_check`: CHECK (((NOT merma_excede_esperada) OR (justificacion IS NOT NULL)))
- `proceso_registro_entrada_total_check`: CHECK ((entrada_total > (0)::numeric))
- `proceso_registro_perdida_total_check`: CHECK ((perdida_total >= (0)::numeric))
- `proceso_registro_salida_total_check`: CHECK ((salida_total > (0)::numeric))
- `proceso_registro_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `proceso_registro_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `proceso_registro_proceso_etapa_id_fkey`: FOREIGN KEY (proceso_etapa_id) REFERENCES proceso_etapa(id)
- `proceso_registro_proceso_tipo_id_fkey`: FOREIGN KEY (proceso_tipo_id) REFERENCES proceso_tipo(id)
- `proceso_registro_responsable_id_fkey`: FOREIGN KEY (responsable_id) REFERENCES usuario(id)
- `proceso_registro_transformacion_id_fkey`: FOREIGN KEY (transformacion_id) REFERENCES transformacion(id)
- `proceso_registro_pkey`: PRIMARY KEY (id)
- `proceso_registro_transformacion_id_key`: UNIQUE (transformacion_id)

Índices:

- `CREATE INDEX proceso_registro_finca_fecha ON public.proceso_registro USING btree (finca_id, fecha DESC)`

## proceso_tipo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| codigo | text | no |  |
| nombre | text | no |  |
| activo | boolean | no | `true` |
| es_demo | boolean | no | `false` |
| creado_por | uuid | sí |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `proceso_tipo_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `proceso_tipo_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `proceso_tipo_pkey`: PRIMARY KEY (id)
- `proceso_tipo_organizacion_id_codigo_key`: UNIQUE (organizacion_id, codigo)

## producto

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| codigo | text | no |  |
| nombre | text | no |  |
| tipo_cafe | text | sí |  |
| categoria | text | sí |  |
| unidad_id | uuid | no |  |
| vendible | boolean | no | `false` |
| activo | boolean | no | `true` |
| es_demo | boolean | no | `false` |

Restricciones:

- `producto_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `producto_unidad_id_fkey`: FOREIGN KEY (unidad_id) REFERENCES unidad(id)
- `producto_pkey`: PRIMARY KEY (id)
- `producto_id_organizacion_id_key`: UNIQUE (id, organizacion_id)
- `producto_organizacion_id_codigo_key`: UNIQUE (organizacion_id, codigo)

## proveedor

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| nombre | text | no |  |
| documento | text | sí |  |
| telefono | text | sí |  |
| correo | text | sí |  |
| activo | boolean | no | `true` |
| autorizo_tratamiento_en | timestamp with time zone | sí |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `proveedor_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `proveedor_pkey`: PRIMARY KEY (id)
- `proveedor_id_organizacion_id_key`: UNIQUE (id, organizacion_id)
- `proveedor_organizacion_id_documento_key`: UNIQUE (organizacion_id, documento)

## proyeccion_cosecha

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| lote_id | uuid | no |  |
| temporada_id | uuid | sí |  |
| desde | date | no |  |
| hasta | date | no |  |
| cantidad_estimada_kg | numeric(14,3) | no |  |
| nota | text | sí |  |
| clave_idempotencia | text | no |  |
| creado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `proyeccion_cosecha_cantidad_estimada_kg_check`: CHECK ((cantidad_estimada_kg > (0)::numeric))
- `proyeccion_cosecha_check`: CHECK ((hasta >= desde))
- `proyeccion_cosecha_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `proyeccion_cosecha_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `proyeccion_cosecha_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `proyeccion_cosecha_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `proyeccion_cosecha_temporada_id_fkey`: FOREIGN KEY (temporada_id) REFERENCES temporada(id)
- `proyeccion_cosecha_pkey`: PRIMARY KEY (id)
- `proyeccion_cosecha_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## registro_ambiental

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| fecha | date | no |  |
| tipo | text | no |  |
| descripcion | text | no |  |
| cantidad | numeric(14,3) | sí |  |
| unidad | text | sí |  |
| clave_idempotencia | text | no |  |
| responsable_id | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `registro_ambiental_tipo_check`: CHECK ((tipo = ANY (ARRAY['envases'::text, 'residuos'::text, 'agua'::text, 'erosion'::text, 'otro'::text])))
- `registro_ambiental_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `registro_ambiental_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `registro_ambiental_responsable_id_fkey`: FOREIGN KEY (responsable_id) REFERENCES usuario(id)
- `registro_ambiental_pkey`: PRIMARY KEY (id)
- `registro_ambiental_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## registro_trabajo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| lote_id | uuid | sí |  |
| trabajador_id | uuid | no |  |
| vinculacion_id | uuid | no |  |
| fecha | date | no |  |
| modalidad | text | no |  |
| actividad | text | sí |  |
| cantidad_declarada | numeric(14,3) | no |  |
| unidad_declarada_id | uuid | no |  |
| cantidad_validada | numeric(14,3) | sí |  |
| estado | text | no | `'pendiente'::text` |
| tarifa_version_id | uuid | sí |  |
| valor_unitario_aplicado | numeric(14,2) | sí |  |
| valor_calculado | numeric(14,2) | sí |  |
| validado_por | uuid | sí |  |
| validado_en | timestamp with time zone | sí |  |
| motivo_rechazo | text | sí |  |
| clave_idempotencia | text | sí |  |
| registrado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `registro_trabajo_cantidad_declarada_check`: CHECK ((cantidad_declarada > (0)::numeric))
- `registro_trabajo_cantidad_validada_check`: CHECK (((cantidad_validada IS NULL) OR (cantidad_validada >= (0)::numeric)))
- `registro_trabajo_check`: CHECK (((estado <> 'validado'::text) OR ((cantidad_validada IS NOT NULL) AND (valor_calculado IS NOT NULL) AND (tarifa_version_id IS NOT NULL))))
- `registro_trabajo_check1`: CHECK (((estado <> 'rechazado'::text) OR (motivo_rechazo IS NOT NULL)))
- `registro_trabajo_estado_check`: CHECK ((estado = ANY (ARRAY['pendiente'::text, 'validado'::text, 'rechazado'::text, 'liquidado'::text])))
- `registro_trabajo_modalidad_check`: CHECK ((modalidad = ANY (ARRAY['kg'::text, 'arroba'::text, 'jornada'::text, 'actividad'::text])))
- `registro_trabajo_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `registro_trabajo_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `registro_trabajo_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `registro_trabajo_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `registro_trabajo_tarifa_version_id_fkey`: FOREIGN KEY (tarifa_version_id) REFERENCES tarifa_version(id)
- `registro_trabajo_trabajador_id_fkey`: FOREIGN KEY (trabajador_id) REFERENCES trabajador(id)
- `registro_trabajo_unidad_declarada_id_fkey`: FOREIGN KEY (unidad_declarada_id) REFERENCES unidad(id)
- `registro_trabajo_validado_por_fkey`: FOREIGN KEY (validado_por) REFERENCES usuario(id)
- `registro_trabajo_vinculacion_id_fkey`: FOREIGN KEY (vinculacion_id) REFERENCES vinculacion(id)
- `registro_trabajo_pkey`: PRIMARY KEY (id)
- `registro_trabajo_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

Índices:

- `CREATE INDEX registro_trabajo_trabajador ON public.registro_trabajo USING btree (trabajador_id, fecha)`

## rol

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| codigo | text | no |  |
| nombre | text | no |  |
| es_extension | boolean | no | `false` |

Restricciones:

- `rol_pkey`: PRIMARY KEY (id)
- `rol_codigo_key`: UNIQUE (codigo)

## rol_permiso

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| rol_id | uuid | no |  |
| permiso_id | uuid | no |  |

Restricciones:

- `rol_permiso_permiso_id_fkey`: FOREIGN KEY (permiso_id) REFERENCES permiso(id) ON DELETE CASCADE
- `rol_permiso_rol_id_fkey`: FOREIGN KEY (rol_id) REFERENCES rol(id) ON DELETE CASCADE
- `rol_permiso_pkey`: PRIMARY KEY (rol_id, permiso_id)

## saldo_inventario

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| bodega_id | uuid | no |  |
| producto_id | uuid | no |  |
| lote_id | uuid | no |  |
| cantidad | numeric(14,3) | no | `0` |
| actualizado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `saldo_inventario_cantidad_check`: CHECK ((cantidad >= (0)::numeric))
- `saldo_inventario_bodega_id_finca_id_fkey`: FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
- `saldo_inventario_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `saldo_inventario_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `saldo_inventario_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `saldo_inventario_pkey`: PRIMARY KEY (id)
- `saldo_inventario_bodega_id_producto_id_lote_id_key`: UNIQUE (bodega_id, producto_id, lote_id)

Índices:

- `CREATE INDEX saldo_producto_idx ON public.saldo_inventario USING btree (finca_id, producto_id) WHERE (cantidad > (0)::numeric)`

## sesion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| token_hash | text | no |  |
| usuario_id | uuid | no |  |
| creada_en | timestamp with time zone | no | `now()` |
| expira_en | timestamp with time zone | no |  |
| csrf_token | text | no |  |

Restricciones:

- `sesion_usuario_id_fkey`: FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
- `sesion_pkey`: PRIMARY KEY (token_hash)

Índices:

- `CREATE INDEX sesion_usuario_idx ON public.sesion USING btree (usuario_id)`

## tarifa

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | sí |  |
| codigo | text | no |  |
| tipo | text | no |  |
| producto_id | uuid | sí |  |
| unidad_id | uuid | no |  |
| estado | text | no | `'activa'::text` |
| creada_en | timestamp with time zone | no | `now()` |
| trabajador_id | uuid | sí |  |
| temporada_id | uuid | sí |  |

Restricciones:

- `tarifa_estado_check`: CHECK ((estado = ANY (ARRAY['activa'::text, 'inactiva'::text])))
- `tarifa_tipo_check`: CHECK ((tipo = ANY (ARRAY['precio_venta'::text, 'precio_compra'::text, 'pago_kg'::text, 'pago_arroba'::text, 'pago_jornada'::text, 'pago_actividad'::text, 'especial'::text])))
- `tarifa_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `tarifa_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `tarifa_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `tarifa_temporada_id_fkey`: FOREIGN KEY (temporada_id) REFERENCES temporada(id)
- `tarifa_trabajador_fk`: FOREIGN KEY (trabajador_id) REFERENCES trabajador(id)
- `tarifa_unidad_id_fkey`: FOREIGN KEY (unidad_id) REFERENCES unidad(id)
- `tarifa_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE UNIQUE INDEX tarifa_unica ON public.tarifa USING btree (organizacion_id, COALESCE(finca_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo, COALESCE(producto_id, '00000000-0000-0000-0000-000000000000'::uuid))`

## tarifa_version

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| tarifa_id | uuid | no |  |
| version | integer | no |  |
| valor | numeric(14,2) | no |  |
| vigencia | daterange | no |  |
| es_demo | boolean | no | `false` |
| creada_por | uuid | sí |  |
| creada_en | timestamp with time zone | no | `now()` |

Restricciones:

- `tarifa_version_valor_check`: CHECK ((valor >= (0)::numeric))
- `tarifa_version_version_check`: CHECK ((version > 0))
- `tarifa_version_creada_por_fkey`: FOREIGN KEY (creada_por) REFERENCES usuario(id)
- `tarifa_version_tarifa_id_fkey`: FOREIGN KEY (tarifa_id) REFERENCES tarifa(id)
- `tarifa_version_pkey`: PRIMARY KEY (id)
- `tarifa_version_tarifa_id_version_key`: UNIQUE (tarifa_id, version)
- `tarifa_version_tarifa_id_vigencia_excl`: EXCLUDE USING gist (tarifa_id WITH =, vigencia WITH &&)

## temporada

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| nombre | text | no |  |
| vigencia | daterange | no |  |

Restricciones:

- `temporada_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `temporada_pkey`: PRIMARY KEY (id)
- `temporada_organizacion_id_vigencia_excl`: EXCLUDE USING gist (organizacion_id WITH =, vigencia WITH &&)

## trabajador

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| usuario_id | uuid | sí |  |
| tipo_documento | text | no | `'CC'::text` |
| numero_documento | text | no |  |
| nombres | text | no |  |
| apellidos | text | no |  |
| telefono | text | sí |  |
| activo | boolean | no | `true` |
| autorizo_tratamiento_en | timestamp with time zone | sí |  |
| finalidad_tratamiento | text | sí |  |
| creado_por | uuid | sí |  |
| creado_en | timestamp with time zone | no | `now()` |
| anonimizado_en | timestamp with time zone | sí |  |

Restricciones:

- `trabajador_tipo_documento_check`: CHECK ((tipo_documento = ANY (ARRAY['CC'::text, 'CE'::text, 'TI'::text, 'PEP'::text, 'PPT'::text, 'otro'::text])))
- `trabajador_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `trabajador_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `trabajador_usuario_id_fkey`: FOREIGN KEY (usuario_id) REFERENCES usuario(id)
- `trabajador_pkey`: PRIMARY KEY (id)
- `trabajador_id_organizacion_id_key`: UNIQUE (id, organizacion_id)
- `trabajador_organizacion_id_tipo_documento_numero_documento_key`: UNIQUE (organizacion_id, tipo_documento, numero_documento)
- `trabajador_usuario_id_key`: UNIQUE (usuario_id)

## transformacion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| bodega_id | uuid | no |  |
| tipo | text | no |  |
| fecha | date | no |  |
| factor_rendimiento | numeric(8,3) | sí |  |
| clave_idempotencia | text | sí |  |
| creado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |
| nota | text | sí |  |

Restricciones:

- `transformacion_bodega_id_finca_id_fkey`: FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
- `transformacion_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `transformacion_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `transformacion_pkey`: PRIMARY KEY (id)
- `transformacion_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

## transformacion_linea

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| transformacion_id | uuid | no |  |
| lote_id | uuid | no |  |
| finca_id | uuid | no |  |
| producto_entrada_id | uuid | no |  |
| producto_salida_id | uuid | no |  |
| cantidad_entrada | numeric(14,3) | no |  |
| cantidad_salida | numeric(14,3) | no |  |
| cantidad_perdida | numeric(14,3) | no | `0` |

Restricciones:

- `transformacion_linea_cantidad_entrada_check`: CHECK ((cantidad_entrada > (0)::numeric))
- `transformacion_linea_cantidad_perdida_check`: CHECK ((cantidad_perdida >= (0)::numeric))
- `transformacion_linea_cantidad_salida_check`: CHECK ((cantidad_salida > (0)::numeric))
- `transformacion_linea_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `transformacion_linea_producto_entrada_id_fkey`: FOREIGN KEY (producto_entrada_id) REFERENCES producto(id)
- `transformacion_linea_producto_salida_id_fkey`: FOREIGN KEY (producto_salida_id) REFERENCES producto(id)
- `transformacion_linea_transformacion_id_fkey`: FOREIGN KEY (transformacion_id) REFERENCES transformacion(id)
- `transformacion_linea_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE INDEX transformacion_linea_idx ON public.transformacion_linea USING btree (lote_id, producto_salida_id)`

## unidad

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| codigo | text | no |  |
| nombre | text | no |  |
| tipo | text | no |  |

Restricciones:

- `unidad_tipo_check`: CHECK ((tipo = ANY (ARRAY['masa'::text, 'tiempo'::text, 'conteo'::text])))
- `unidad_pkey`: PRIMARY KEY (id)
- `unidad_codigo_key`: UNIQUE (codigo)

## uso_equipo

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| equipo_id | uuid | no |  |
| fecha | date | no |  |
| horas | numeric(8,2) | no |  |
| combustible_litros | numeric(8,2) | sí |  |
| nota | text | sí |  |
| clave_idempotencia | text | no |  |
| registrado_por | uuid | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `uso_equipo_combustible_litros_check`: CHECK (((combustible_litros IS NULL) OR (combustible_litros >= (0)::numeric)))
- `uso_equipo_horas_check`: CHECK ((horas > (0)::numeric))
- `uso_equipo_equipo_id_fkey`: FOREIGN KEY (equipo_id) REFERENCES equipo(id)
- `uso_equipo_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `uso_equipo_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `uso_equipo_pkey`: PRIMARY KEY (id)
- `uso_equipo_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

## usuario

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| correo | text | no |  |
| nombre | text | no |  |
| password_hash | text | no |  |
| activo | boolean | no | `true` |
| autorizo_tratamiento_en | timestamp with time zone | sí |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `usuario_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `usuario_pkey`: PRIMARY KEY (id)
- `usuario_id_organizacion_id_key`: UNIQUE (id, organizacion_id)

Índices:

- `CREATE UNIQUE INDEX usuario_correo_unico ON public.usuario USING btree (lower(correo))`

## usuario_finca

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| usuario_id | uuid | no |  |
| finca_id | uuid | no |  |

Restricciones:

- `usuario_finca_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id) ON DELETE CASCADE
- `usuario_finca_usuario_id_fkey`: FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
- `usuario_finca_pkey`: PRIMARY KEY (usuario_id, finca_id)

## usuario_permiso_extra

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| usuario_id | uuid | no |  |
| permiso_id | uuid | no |  |

Restricciones:

- `usuario_permiso_extra_permiso_id_fkey`: FOREIGN KEY (permiso_id) REFERENCES permiso(id)
- `usuario_permiso_extra_usuario_id_fkey`: FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
- `usuario_permiso_extra_pkey`: PRIMARY KEY (usuario_id, permiso_id)

## usuario_rol

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| usuario_id | uuid | no |  |
| rol_id | uuid | no |  |

Restricciones:

- `usuario_rol_rol_id_fkey`: FOREIGN KEY (rol_id) REFERENCES rol(id)
- `usuario_rol_usuario_id_fkey`: FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
- `usuario_rol_pkey`: PRIMARY KEY (usuario_id, rol_id)

## venta

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| finca_id | uuid | no |  |
| cliente_id | uuid | no |  |
| pedido_id | uuid | sí |  |
| numero_comprobante | bigint | no | `nextval('comprobante_seq'::regclass)` |
| fecha | timestamp with time zone | no | `now()` |
| estado | text | no | `'confirmada'::text` |
| descuento_total | numeric(14,2) | no | `0` |
| total | numeric(14,2) | no |  |
| clave_idempotencia | text | no |  |
| creado_por | uuid | no |  |
| nota | text | sí |  |
| anulada_por | uuid | sí |  |
| anulada_en | timestamp with time zone | sí |  |
| motivo_anulacion | text | sí |  |

Restricciones:

- `venta_anulacion_completa`: CHECK (((estado <> 'anulada'::text) OR ((anulada_por IS NOT NULL) AND (anulada_en IS NOT NULL) AND (motivo_anulacion IS NOT NULL))))
- `venta_descuento_total_check`: CHECK ((descuento_total >= (0)::numeric))
- `venta_estado_check`: CHECK ((estado = ANY (ARRAY['confirmada'::text, 'anulada'::text])))
- `venta_total_check`: CHECK ((total >= (0)::numeric))
- `venta_anulada_por_fkey`: FOREIGN KEY (anulada_por) REFERENCES usuario(id)
- `venta_cliente_id_organizacion_id_fkey`: FOREIGN KEY (cliente_id, organizacion_id) REFERENCES cliente(id, organizacion_id)
- `venta_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `venta_finca_id_organizacion_id_fkey`: FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id)
- `venta_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `venta_pedido_id_fkey`: FOREIGN KEY (pedido_id) REFERENCES pedido(id)
- `venta_pkey`: PRIMARY KEY (id)
- `venta_id_organizacion_id_key`: UNIQUE (id, organizacion_id)
- `venta_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

Índices:

- `CREATE INDEX venta_cliente_idx ON public.venta USING btree (cliente_id, fecha DESC)`
- `CREATE INDEX venta_finca_fecha_idx ON public.venta USING btree (finca_id, fecha DESC)`

## venta_detalle

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| venta_id | uuid | no |  |
| producto_id | uuid | no |  |
| lote_id | uuid | no |  |
| finca_id | uuid | no |  |
| bodega_id | uuid | no |  |
| cantidad | numeric(14,3) | no |  |
| precio_unitario | numeric(14,2) | no |  |
| tarifa_version_id | uuid | sí |  |
| descuento | numeric(14,2) | no | `0` |
| subtotal | numeric(14,2) | no |  |
| movimiento_id | uuid | no |  |

Restricciones:

- `venta_detalle_cantidad_check`: CHECK ((cantidad > (0)::numeric))
- `venta_detalle_descuento_check`: CHECK ((descuento >= (0)::numeric))
- `venta_detalle_precio_unitario_check`: CHECK ((precio_unitario >= (0)::numeric))
- `venta_detalle_subtotal_check`: CHECK ((subtotal >= (0)::numeric))
- `venta_detalle_bodega_id_finca_id_fkey`: FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
- `venta_detalle_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `venta_detalle_movimiento_id_fkey`: FOREIGN KEY (movimiento_id) REFERENCES movimiento_inventario(id)
- `venta_detalle_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `venta_detalle_tarifa_version_id_fkey`: FOREIGN KEY (tarifa_version_id) REFERENCES tarifa_version(id)
- `venta_detalle_venta_id_fkey`: FOREIGN KEY (venta_id) REFERENCES venta(id)
- `venta_detalle_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE INDEX venta_detalle_lote_idx ON public.venta_detalle USING btree (lote_id, producto_id)`
- `CREATE INDEX venta_detalle_venta_idx ON public.venta_detalle USING btree (venta_id)`

## vinculacion

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| organizacion_id | uuid | no |  |
| trabajador_id | uuid | no |  |
| finca_id | uuid | no |  |
| modalidad | text | no |  |
| cargo | text | sí |  |
| vigencia | daterange | no |  |
| creada_en | timestamp with time zone | no | `now()` |

Restricciones:

- `vinculacion_modalidad_check`: CHECK ((modalidad = ANY (ARRAY['kg'::text, 'arroba'::text, 'jornada'::text, 'actividad'::text])))
- `vinculacion_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `vinculacion_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `vinculacion_trabajador_id_fkey`: FOREIGN KEY (trabajador_id) REFERENCES trabajador(id)
- `vinculacion_pkey`: PRIMARY KEY (id)
- `vinculacion_trabajador_id_finca_id_vigencia_excl`: EXCLUDE USING gist (trabajador_id WITH =, finca_id WITH =, vigencia WITH &&)

