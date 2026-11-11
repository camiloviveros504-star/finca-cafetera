# Relaciones entre tablas

> Generado desde el esquema real de PostgreSQL (llaves foráneas). La prueba `tests/integracion/plataforma.test.ts` vuelve a comprobar en cada ejecución que **no hay ciclos**: si alguien introduce uno, la prueba falla.

## Resultado

- Tablas: **63**. Llaves foráneas: **184**.
- **Ciclos entre tablas: ninguno.** Las dependencias forman un grafo dirigido sin retorno: se puede crear el esquema, y borrar los datos, en un orden estricto.
- Autorreferencias: `movimiento_inventario`. Es `movimiento_inventario.revierte_a`: un reverso apunta al movimiento que corrige. Es un árbol (un movimiento se reversa una sola vez), no un ciclo, y es deliberado: los movimientos de inventario no se editan ni se borran, se compensan.
- Profundidad máxima de dependencia: **7 niveles**.

## Niveles de dependencia

Una tabla de un nivel solo depende de tablas de niveles anteriores.

| Nivel | Tablas |
|---|---|
| 0 | `auditoria`, `intento_acceso`, `organizacion`, `permiso`, `rol`, `unidad` |
| 1 | `catalogo_valor`, `finca`, `producto`, `recomendacion_cultivo`, `rol_permiso`, `temporada`, `usuario` |
| 2 | `agroquimico`, `bodega`, `cliente`, `conversion_unidad`, `equipo`, `invitacion_usuario`, `lote`, `parametro`, `proceso_tipo`, `proveedor`, `registro_ambiental`, `sesion`, `trabajador`, `usuario_finca`, `usuario_permiso_extra`, `usuario_rol` |
| 3 | `actividad_programada`, `agroquimico_stock`, `anticipo`, `compra`, `cosecha`, `inspeccion`, `liquidacion`, `lote_evento`, `movimiento_inventario`, `pedido`, `proceso_etapa`, `proyeccion_cosecha`, `saldo_inventario`, `tarifa`, `transformacion`, `uso_equipo`, `vinculacion` |
| 4 | `agroquimico_movimiento`, `aplicacion_agroquimica`, `compra_detalle`, `liquidacion_anticipo`, `pago_proveedor`, `pago_trabajador`, `pedido_detalle`, `proceso_registro`, `tarifa_version`, `transformacion_linea`, `venta` |
| 5 | `gasto`, `pago_cliente`, `registro_trabajo`, `venta_detalle` |
| 6 | `liquidacion_detalle`, `mantenimiento` |

## Tablas más referenciadas

| Tabla | Tablas que la referencian |
|---|---|
| `organizacion` | 44 |
| `usuario` | 39 |
| `finca` | 23 |
| `lote` | 12 |
| `producto` | 10 |
| `unidad` | 6 |
| `bodega` | 5 |
| `trabajador` | 5 |

## Cómo se evitan los ciclos

- **El alcance por finca** se guarda en tablas puente (`usuario_finca`, `vinculacion`), no en columnas cruzadas entre usuario y finca.
- **Lo compartido y lo propio de cada finca** usa una columna `finca_id` opcional en la tabla (`cliente`, `proveedor`, `agroquimico`): vacía es compartido; con valor, es de esa finca. No hay tabla intermedia que cierre un círculo.
- **Los hechos se apuntan hacia atrás**: una compra apunta al insumo, un gasto apunta a la venta, un movimiento apunta a su origen; nunca al revés. Por eso la eliminación de un registro con historial se rechaza (o se archiva) en lugar de borrar en cascada.
- **Lotes y fincas** se relacionan con llave compuesta `(lote_id, finca_id)`, que impide registrar algo con un lote de otra finca sin necesidad de columnas circulares.
