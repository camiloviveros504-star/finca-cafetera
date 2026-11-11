# Diccionario de datos

> Generado con `npx tsx db/diccionario.ts` desde el esquema real de PostgreSQL. No se edita a mano.

Tablas: 33. Montos `numeric(14,2)`, cantidades `numeric(14,3)`, fechas `timestamptz`, claves primarias `uuid`.

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
- `auditoria_accion_not_null`: NOT NULL accion
- `auditoria_creado_en_not_null`: NOT NULL creado_en
- `auditoria_entidad_not_null`: NOT NULL entidad
- `auditoria_id_not_null`: NOT NULL id
- `auditoria_resultado_not_null`: NOT NULL resultado
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
- `bodega_finca_id_not_null`: NOT NULL finca_id
- `bodega_id_not_null`: NOT NULL id
- `bodega_nombre_not_null`: NOT NULL nombre
- `bodega_organizacion_id_not_null`: NOT NULL organizacion_id
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
- `catalogo_valor_activo_not_null`: NOT NULL activo
- `catalogo_valor_catalogo_not_null`: NOT NULL catalogo
- `catalogo_valor_codigo_not_null`: NOT NULL codigo
- `catalogo_valor_id_not_null`: NOT NULL id
- `catalogo_valor_nombre_not_null`: NOT NULL nombre
- `catalogo_valor_organizacion_id_not_null`: NOT NULL organizacion_id
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

Restricciones:

- `cliente_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `cliente_activo_not_null`: NOT NULL activo
- `cliente_creado_en_not_null`: NOT NULL creado_en
- `cliente_finalidad_tratamiento_not_null`: NOT NULL finalidad_tratamiento
- `cliente_id_not_null`: NOT NULL id
- `cliente_nombre_not_null`: NOT NULL nombre
- `cliente_organizacion_id_not_null`: NOT NULL organizacion_id
- `cliente_pkey`: PRIMARY KEY (id)
- `cliente_id_organizacion_id_key`: UNIQUE (id, organizacion_id)

Índices:

- `CREATE INDEX cliente_org_nombre_idx ON public.cliente USING btree (organizacion_id, lower(nombre))`

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
- `conversion_unidad_creada_en_not_null`: NOT NULL creada_en
- `conversion_unidad_es_demo_not_null`: NOT NULL es_demo
- `conversion_unidad_factor_not_null`: NOT NULL factor
- `conversion_unidad_id_not_null`: NOT NULL id
- `conversion_unidad_organizacion_id_not_null`: NOT NULL organizacion_id
- `conversion_unidad_unidad_destino_id_not_null`: NOT NULL unidad_destino_id
- `conversion_unidad_unidad_origen_id_not_null`: NOT NULL unidad_origen_id
- `conversion_unidad_vigencia_not_null`: NOT NULL vigencia
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

Restricciones:

- `cosecha_cantidad_base_check`: CHECK ((cantidad_base > (0)::numeric))
- `cosecha_cantidad_check`: CHECK ((cantidad > (0)::numeric))
- `cosecha_estado_check`: CHECK ((estado = ANY (ARRAY['confirmada'::text, 'anulada'::text])))
- `cosecha_factor_aplicado_check`: CHECK ((factor_aplicado > (0)::numeric))
- `cosecha_bodega_id_finca_id_fkey`: FOREIGN KEY (bodega_id, finca_id) REFERENCES bodega(id, finca_id)
- `cosecha_lote_id_finca_id_fkey`: FOREIGN KEY (lote_id, finca_id) REFERENCES lote(id, finca_id)
- `cosecha_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `cosecha_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `cosecha_registrado_por_fkey`: FOREIGN KEY (registrado_por) REFERENCES usuario(id)
- `cosecha_unidad_id_fkey`: FOREIGN KEY (unidad_id) REFERENCES unidad(id)
- `cosecha_bodega_id_not_null`: NOT NULL bodega_id
- `cosecha_cantidad_base_not_null`: NOT NULL cantidad_base
- `cosecha_cantidad_not_null`: NOT NULL cantidad
- `cosecha_capturada_en_not_null`: NOT NULL capturada_en
- `cosecha_clave_idempotencia_not_null`: NOT NULL clave_idempotencia
- `cosecha_estado_not_null`: NOT NULL estado
- `cosecha_factor_aplicado_not_null`: NOT NULL factor_aplicado
- `cosecha_fecha_not_null`: NOT NULL fecha
- `cosecha_finca_id_not_null`: NOT NULL finca_id
- `cosecha_id_not_null`: NOT NULL id
- `cosecha_lote_id_not_null`: NOT NULL lote_id
- `cosecha_organizacion_id_not_null`: NOT NULL organizacion_id
- `cosecha_producto_id_not_null`: NOT NULL producto_id
- `cosecha_recibida_en_not_null`: NOT NULL recibida_en
- `cosecha_registrado_por_not_null`: NOT NULL registrado_por
- `cosecha_unidad_id_not_null`: NOT NULL unidad_id
- `cosecha_pkey`: PRIMARY KEY (id)
- `cosecha_clave_idempotencia_key`: UNIQUE (clave_idempotencia)

Índices:

- `CREATE INDEX cosecha_finca_fecha_idx ON public.cosecha USING btree (finca_id, fecha DESC)`
- `CREATE INDEX cosecha_lote_fecha_idx ON public.cosecha USING btree (lote_id, fecha DESC)`

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
- `finca_activa_not_null`: NOT NULL activa
- `finca_creada_en_not_null`: NOT NULL creada_en
- `finca_id_not_null`: NOT NULL id
- `finca_nombre_not_null`: NOT NULL nombre
- `finca_organizacion_id_not_null`: NOT NULL organizacion_id
- `finca_pkey`: PRIMARY KEY (id)
- `finca_id_organizacion_id_key`: UNIQUE (id, organizacion_id)
- `finca_organizacion_id_nombre_key`: UNIQUE (organizacion_id, nombre)

## intento_acceso

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | bigint | no | `nextval('intento_acceso_id_seq'::regclass)` |
| correo_hash | text | no |  |
| ip | text | no |  |
| exitoso | boolean | no |  |
| creado_en | timestamp with time zone | no | `now()` |

Restricciones:

- `intento_acceso_correo_hash_not_null`: NOT NULL correo_hash
- `intento_acceso_creado_en_not_null`: NOT NULL creado_en
- `intento_acceso_exitoso_not_null`: NOT NULL exitoso
- `intento_acceso_id_not_null`: NOT NULL id
- `intento_acceso_ip_not_null`: NOT NULL ip
- `intento_acceso_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE INDEX intento_acceso_correo_idx ON public.intento_acceso USING btree (correo_hash, creado_en DESC)`
- `CREATE INDEX intento_acceso_ip_idx ON public.intento_acceso USING btree (ip, creado_en DESC)`

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
- `lote_codigo_not_null`: NOT NULL codigo
- `lote_creado_en_not_null`: NOT NULL creado_en
- `lote_estado_productivo_not_null`: NOT NULL estado_productivo
- `lote_finca_id_not_null`: NOT NULL finca_id
- `lote_id_not_null`: NOT NULL id
- `lote_nombre_not_null`: NOT NULL nombre
- `lote_organizacion_id_not_null`: NOT NULL organizacion_id
- `lote_pkey`: PRIMARY KEY (id)
- `lote_finca_id_codigo_key`: UNIQUE (finca_id, codigo)
- `lote_id_finca_id_key`: UNIQUE (id, finca_id)

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
- `movimiento_inventario_bodega_id_not_null`: NOT NULL bodega_id
- `movimiento_inventario_creado_en_not_null`: NOT NULL creado_en
- `movimiento_inventario_creado_por_not_null`: NOT NULL creado_por
- `movimiento_inventario_delta_not_null`: NOT NULL delta
- `movimiento_inventario_finca_id_not_null`: NOT NULL finca_id
- `movimiento_inventario_id_not_null`: NOT NULL id
- `movimiento_inventario_lote_id_not_null`: NOT NULL lote_id
- `movimiento_inventario_organizacion_id_not_null`: NOT NULL organizacion_id
- `movimiento_inventario_origen_tipo_not_null`: NOT NULL origen_tipo
- `movimiento_inventario_producto_id_not_null`: NOT NULL producto_id
- `movimiento_inventario_tipo_not_null`: NOT NULL tipo
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

- `organizacion_creada_en_not_null`: NOT NULL creada_en
- `organizacion_es_demo_not_null`: NOT NULL es_demo
- `organizacion_id_not_null`: NOT NULL id
- `organizacion_nombre_not_null`: NOT NULL nombre
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
- `pago_cliente_clave_idempotencia_not_null`: NOT NULL clave_idempotencia
- `pago_cliente_fecha_not_null`: NOT NULL fecha
- `pago_cliente_id_not_null`: NOT NULL id
- `pago_cliente_metodo_not_null`: NOT NULL metodo
- `pago_cliente_monto_not_null`: NOT NULL monto
- `pago_cliente_organizacion_id_not_null`: NOT NULL organizacion_id
- `pago_cliente_registrado_por_not_null`: NOT NULL registrado_por
- `pago_cliente_venta_id_not_null`: NOT NULL venta_id
- `pago_cliente_pkey`: PRIMARY KEY (id)
- `pago_cliente_organizacion_id_clave_idempotencia_key`: UNIQUE (organizacion_id, clave_idempotencia)

Índices:

- `CREATE INDEX pago_venta_idx ON public.pago_cliente USING btree (venta_id)`

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
- `parametro_actualizado_en_not_null`: NOT NULL actualizado_en
- `parametro_clave_not_null`: NOT NULL clave
- `parametro_id_not_null`: NOT NULL id
- `parametro_organizacion_id_not_null`: NOT NULL organizacion_id
- `parametro_valor_not_null`: NOT NULL valor
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
- `pedido_cliente_id_not_null`: NOT NULL cliente_id
- `pedido_creado_en_not_null`: NOT NULL creado_en
- `pedido_creado_por_not_null`: NOT NULL creado_por
- `pedido_estado_not_null`: NOT NULL estado
- `pedido_fecha_not_null`: NOT NULL fecha
- `pedido_finca_id_not_null`: NOT NULL finca_id
- `pedido_id_not_null`: NOT NULL id
- `pedido_organizacion_id_not_null`: NOT NULL organizacion_id
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
- `pedido_detalle_cantidad_not_null`: NOT NULL cantidad
- `pedido_detalle_id_not_null`: NOT NULL id
- `pedido_detalle_pedido_id_not_null`: NOT NULL pedido_id
- `pedido_detalle_producto_id_not_null`: NOT NULL producto_id
- `pedido_detalle_pkey`: PRIMARY KEY (id)

## permiso

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| codigo | text | no |  |
| descripcion | text | no |  |

Restricciones:

- `permiso_codigo_not_null`: NOT NULL codigo
- `permiso_descripcion_not_null`: NOT NULL descripcion
- `permiso_id_not_null`: NOT NULL id
- `permiso_pkey`: PRIMARY KEY (id)
- `permiso_codigo_key`: UNIQUE (codigo)

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
- `producto_activo_not_null`: NOT NULL activo
- `producto_codigo_not_null`: NOT NULL codigo
- `producto_es_demo_not_null`: NOT NULL es_demo
- `producto_id_not_null`: NOT NULL id
- `producto_nombre_not_null`: NOT NULL nombre
- `producto_organizacion_id_not_null`: NOT NULL organizacion_id
- `producto_unidad_id_not_null`: NOT NULL unidad_id
- `producto_vendible_not_null`: NOT NULL vendible
- `producto_pkey`: PRIMARY KEY (id)
- `producto_id_organizacion_id_key`: UNIQUE (id, organizacion_id)
- `producto_organizacion_id_codigo_key`: UNIQUE (organizacion_id, codigo)

## rol

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| id | uuid | no | `gen_random_uuid()` |
| codigo | text | no |  |
| nombre | text | no |  |
| es_extension | boolean | no | `false` |

Restricciones:

- `rol_codigo_not_null`: NOT NULL codigo
- `rol_es_extension_not_null`: NOT NULL es_extension
- `rol_id_not_null`: NOT NULL id
- `rol_nombre_not_null`: NOT NULL nombre
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
- `rol_permiso_permiso_id_not_null`: NOT NULL permiso_id
- `rol_permiso_rol_id_not_null`: NOT NULL rol_id
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
- `saldo_inventario_actualizado_en_not_null`: NOT NULL actualizado_en
- `saldo_inventario_bodega_id_not_null`: NOT NULL bodega_id
- `saldo_inventario_cantidad_not_null`: NOT NULL cantidad
- `saldo_inventario_finca_id_not_null`: NOT NULL finca_id
- `saldo_inventario_id_not_null`: NOT NULL id
- `saldo_inventario_lote_id_not_null`: NOT NULL lote_id
- `saldo_inventario_organizacion_id_not_null`: NOT NULL organizacion_id
- `saldo_inventario_producto_id_not_null`: NOT NULL producto_id
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
- `sesion_creada_en_not_null`: NOT NULL creada_en
- `sesion_csrf_token_not_null`: NOT NULL csrf_token
- `sesion_expira_en_not_null`: NOT NULL expira_en
- `sesion_token_hash_not_null`: NOT NULL token_hash
- `sesion_usuario_id_not_null`: NOT NULL usuario_id
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

Restricciones:

- `tarifa_estado_check`: CHECK ((estado = ANY (ARRAY['activa'::text, 'inactiva'::text])))
- `tarifa_tipo_check`: CHECK ((tipo = ANY (ARRAY['precio_venta'::text, 'precio_compra'::text, 'pago_kg'::text, 'pago_arroba'::text, 'pago_jornada'::text, 'pago_actividad'::text, 'especial'::text])))
- `tarifa_finca_id_fkey`: FOREIGN KEY (finca_id) REFERENCES finca(id)
- `tarifa_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `tarifa_producto_id_fkey`: FOREIGN KEY (producto_id) REFERENCES producto(id)
- `tarifa_unidad_id_fkey`: FOREIGN KEY (unidad_id) REFERENCES unidad(id)
- `tarifa_codigo_not_null`: NOT NULL codigo
- `tarifa_creada_en_not_null`: NOT NULL creada_en
- `tarifa_estado_not_null`: NOT NULL estado
- `tarifa_id_not_null`: NOT NULL id
- `tarifa_organizacion_id_not_null`: NOT NULL organizacion_id
- `tarifa_tipo_not_null`: NOT NULL tipo
- `tarifa_unidad_id_not_null`: NOT NULL unidad_id
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
- `tarifa_version_creada_en_not_null`: NOT NULL creada_en
- `tarifa_version_es_demo_not_null`: NOT NULL es_demo
- `tarifa_version_id_not_null`: NOT NULL id
- `tarifa_version_tarifa_id_not_null`: NOT NULL tarifa_id
- `tarifa_version_valor_not_null`: NOT NULL valor
- `tarifa_version_version_not_null`: NOT NULL version
- `tarifa_version_vigencia_not_null`: NOT NULL vigencia
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
- `temporada_id_not_null`: NOT NULL id
- `temporada_nombre_not_null`: NOT NULL nombre
- `temporada_organizacion_id_not_null`: NOT NULL organizacion_id
- `temporada_vigencia_not_null`: NOT NULL vigencia
- `temporada_pkey`: PRIMARY KEY (id)
- `temporada_organizacion_id_vigencia_excl`: EXCLUDE USING gist (organizacion_id WITH =, vigencia WITH &&)

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
- `transformacion_bodega_id_not_null`: NOT NULL bodega_id
- `transformacion_creado_en_not_null`: NOT NULL creado_en
- `transformacion_creado_por_not_null`: NOT NULL creado_por
- `transformacion_fecha_not_null`: NOT NULL fecha
- `transformacion_finca_id_not_null`: NOT NULL finca_id
- `transformacion_id_not_null`: NOT NULL id
- `transformacion_organizacion_id_not_null`: NOT NULL organizacion_id
- `transformacion_tipo_not_null`: NOT NULL tipo
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
- `transformacion_linea_cantidad_entrada_not_null`: NOT NULL cantidad_entrada
- `transformacion_linea_cantidad_perdida_not_null`: NOT NULL cantidad_perdida
- `transformacion_linea_cantidad_salida_not_null`: NOT NULL cantidad_salida
- `transformacion_linea_finca_id_not_null`: NOT NULL finca_id
- `transformacion_linea_id_not_null`: NOT NULL id
- `transformacion_linea_lote_id_not_null`: NOT NULL lote_id
- `transformacion_linea_producto_entrada_id_not_null`: NOT NULL producto_entrada_id
- `transformacion_linea_producto_salida_id_not_null`: NOT NULL producto_salida_id
- `transformacion_linea_transformacion_id_not_null`: NOT NULL transformacion_id
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
- `unidad_codigo_not_null`: NOT NULL codigo
- `unidad_id_not_null`: NOT NULL id
- `unidad_nombre_not_null`: NOT NULL nombre
- `unidad_tipo_not_null`: NOT NULL tipo
- `unidad_pkey`: PRIMARY KEY (id)
- `unidad_codigo_key`: UNIQUE (codigo)

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
- `usuario_activo_not_null`: NOT NULL activo
- `usuario_correo_not_null`: NOT NULL correo
- `usuario_creado_en_not_null`: NOT NULL creado_en
- `usuario_id_not_null`: NOT NULL id
- `usuario_nombre_not_null`: NOT NULL nombre
- `usuario_organizacion_id_not_null`: NOT NULL organizacion_id
- `usuario_password_hash_not_null`: NOT NULL password_hash
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
- `usuario_finca_finca_id_not_null`: NOT NULL finca_id
- `usuario_finca_usuario_id_not_null`: NOT NULL usuario_id
- `usuario_finca_pkey`: PRIMARY KEY (usuario_id, finca_id)

## usuario_permiso_extra

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| usuario_id | uuid | no |  |
| permiso_id | uuid | no |  |

Restricciones:

- `usuario_permiso_extra_permiso_id_fkey`: FOREIGN KEY (permiso_id) REFERENCES permiso(id)
- `usuario_permiso_extra_usuario_id_fkey`: FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
- `usuario_permiso_extra_permiso_id_not_null`: NOT NULL permiso_id
- `usuario_permiso_extra_usuario_id_not_null`: NOT NULL usuario_id
- `usuario_permiso_extra_pkey`: PRIMARY KEY (usuario_id, permiso_id)

## usuario_rol

| Columna | Tipo | Nulo | Por defecto |
|---|---|---|---|
| usuario_id | uuid | no |  |
| rol_id | uuid | no |  |

Restricciones:

- `usuario_rol_rol_id_fkey`: FOREIGN KEY (rol_id) REFERENCES rol(id)
- `usuario_rol_usuario_id_fkey`: FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
- `usuario_rol_rol_id_not_null`: NOT NULL rol_id
- `usuario_rol_usuario_id_not_null`: NOT NULL usuario_id
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

Restricciones:

- `venta_descuento_total_check`: CHECK ((descuento_total >= (0)::numeric))
- `venta_estado_check`: CHECK ((estado = ANY (ARRAY['confirmada'::text, 'anulada'::text])))
- `venta_total_check`: CHECK ((total >= (0)::numeric))
- `venta_cliente_id_organizacion_id_fkey`: FOREIGN KEY (cliente_id, organizacion_id) REFERENCES cliente(id, organizacion_id)
- `venta_creado_por_fkey`: FOREIGN KEY (creado_por) REFERENCES usuario(id)
- `venta_finca_id_organizacion_id_fkey`: FOREIGN KEY (finca_id, organizacion_id) REFERENCES finca(id, organizacion_id)
- `venta_organizacion_id_fkey`: FOREIGN KEY (organizacion_id) REFERENCES organizacion(id)
- `venta_pedido_id_fkey`: FOREIGN KEY (pedido_id) REFERENCES pedido(id)
- `venta_clave_idempotencia_not_null`: NOT NULL clave_idempotencia
- `venta_cliente_id_not_null`: NOT NULL cliente_id
- `venta_creado_por_not_null`: NOT NULL creado_por
- `venta_descuento_total_not_null`: NOT NULL descuento_total
- `venta_estado_not_null`: NOT NULL estado
- `venta_fecha_not_null`: NOT NULL fecha
- `venta_finca_id_not_null`: NOT NULL finca_id
- `venta_id_not_null`: NOT NULL id
- `venta_numero_comprobante_not_null`: NOT NULL numero_comprobante
- `venta_organizacion_id_not_null`: NOT NULL organizacion_id
- `venta_total_not_null`: NOT NULL total
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
- `venta_detalle_bodega_id_not_null`: NOT NULL bodega_id
- `venta_detalle_cantidad_not_null`: NOT NULL cantidad
- `venta_detalle_descuento_not_null`: NOT NULL descuento
- `venta_detalle_finca_id_not_null`: NOT NULL finca_id
- `venta_detalle_id_not_null`: NOT NULL id
- `venta_detalle_lote_id_not_null`: NOT NULL lote_id
- `venta_detalle_movimiento_id_not_null`: NOT NULL movimiento_id
- `venta_detalle_precio_unitario_not_null`: NOT NULL precio_unitario
- `venta_detalle_producto_id_not_null`: NOT NULL producto_id
- `venta_detalle_subtotal_not_null`: NOT NULL subtotal
- `venta_detalle_venta_id_not_null`: NOT NULL venta_id
- `venta_detalle_pkey`: PRIMARY KEY (id)

Índices:

- `CREATE INDEX venta_detalle_lote_idx ON public.venta_detalle USING btree (lote_id, producto_id)`
- `CREATE INDEX venta_detalle_venta_idx ON public.venta_detalle USING btree (venta_id)`

