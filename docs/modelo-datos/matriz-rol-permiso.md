# Matriz rol-permiso

> Generada con `npx tsx db/matriz.ts` desde la base. Los permisos se comprueban en el servidor, en la capa de aplicación de cada caso de uso.

| Permiso | Administrador | Encargado de producción | Responsable comercial | Auditor o usuario de consulta | Trabajador recolector | Responsable de bodega | Responsable financiero | Supervisor de campo |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `agroquimico:administrar` · Registrar entradas y bajas de agroquímicos | ✔ |  |  |  |  | ✔ |  |  |
| `agroquimico:ver` · Consultar el inventario de agroquímicos y las aplicaciones | ✔ | ✔ |  | ✔ |  | ✔ |  |  |
| `anticipo:registrar` · Registrar anticipos a trabajadores | ✔ |  |  |  |  |  | ✔ |  |
| `aplicacion:registrar` · Registrar aplicaciones de agroquímicos | ✔ | ✔ |  |  |  |  |  |  |
| `auditoria:ver` · Consultar la auditoría | ✔ |  |  | ✔ |  |  |  |  |
| `bodega:administrar` · Crear y modificar bodegas | ✔ |  |  |  |  | ✔ |  |  |
| `cliente:administrar` · Crear y modificar clientes | ✔ |  | ✔ |  |  |  |  |  |
| `cliente:ver` · Consultar clientes | ✔ |  | ✔ | ✔ |  |  |  |  |
| `compra:crear` · Registrar pedidos de compra | ✔ | ✔ |  |  |  |  | ✔ |  |
| `compra:recibir` · Registrar la recepción de una compra | ✔ | ✔ |  |  |  | ✔ | ✔ |  |
| `compra:ver` · Consultar compras y cuentas por pagar | ✔ | ✔ |  | ✔ |  | ✔ | ✔ |  |
| `configuracion:modificar` · Modificar configuración, unidades y equivalencias | ✔ |  |  |  |  |  |  |  |
| `configuracion:ver` · Consultar configuración | ✔ |  |  | ✔ |  |  |  |  |
| `cosecha:anular` · Anular cosechas (con reverso de inventario) | ✔ |  |  |  |  |  |  |  |
| `cosecha:registrar` · Registrar cosechas | ✔ | ✔ |  |  |  |  |  |  |
| `cosecha:ver` · Consultar cosechas | ✔ | ✔ |  | ✔ |  |  |  | ✔ |
| `datos_personales:gestionar` · Atender solicitudes de los titulares: consulta, rectificación y supresión (Ley 1581) | ✔ |  |  |  |  |  |  |  |
| `equipo:administrar` · Crear equipos y registrar mantenimientos | ✔ |  |  |  |  |  |  |  |
| `equipo:registrar_uso` · Registrar el uso de equipos | ✔ | ✔ |  |  |  |  |  | ✔ |
| `equipo:ver` · Consultar maquinaria, usos y mantenimientos | ✔ | ✔ |  | ✔ |  | ✔ |  | ✔ |
| `finanzas:ver` · Consultar el resumen financiero, la cartera y la conciliación | ✔ |  |  | ✔ |  |  | ✔ |  |
| `finca:administrar` · Crear y modificar fincas | ✔ |  |  |  |  |  |  |  |
| `finca:ver` · Consultar fincas | ✔ | ✔ | ✔ | ✔ |  | ✔ | ✔ | ✔ |
| `gasto:registrar` · Registrar gastos administrativos y agrícolas | ✔ | ✔ |  |  |  |  | ✔ |  |
| `gasto:ver` · Consultar gastos | ✔ | ✔ |  | ✔ |  |  | ✔ |  |
| `inspeccion:registrar` · Registrar inspecciones y registros ambientales | ✔ | ✔ |  |  |  |  |  | ✔ |
| `inspeccion:ver` · Consultar inspecciones y registros ambientales | ✔ | ✔ |  | ✔ |  |  |  | ✔ |
| `inventario:ajustar` · Registrar ajustes, pérdidas y conteos físicos | ✔ | ✔ |  |  |  | ✔ |  |  |
| `inventario:reversar` · Reversar movimientos confirmados | ✔ |  |  |  |  |  |  |  |
| `inventario:transformar` · Registrar transformaciones | ✔ | ✔ |  |  |  | ✔ |  |  |
| `inventario:trasladar` · Trasladar entre bodegas | ✔ |  |  |  |  | ✔ |  |  |
| `inventario:ver` · Consultar existencias y movimientos | ✔ | ✔ | ✔ | ✔ |  | ✔ |  | ✔ |
| `liquidacion:crear` · Liquidar un período | ✔ |  |  |  |  |  | ✔ |  |
| `liquidacion:ver` · Consultar liquidaciones | ✔ |  |  | ✔ |  |  | ✔ |  |
| `lote:administrar` · Crear y modificar lotes | ✔ | ✔ |  |  |  |  |  |  |
| `lote:ver` · Consultar lotes | ✔ | ✔ |  | ✔ | ✔ | ✔ |  | ✔ |
| `pago_proveedor:registrar` · Registrar pagos a proveedores | ✔ |  |  |  |  |  | ✔ |  |
| `pago:registrar` · Registrar pagos de clientes | ✔ |  | ✔ |  |  |  | ✔ |  |
| `pago_trabajador:registrar` · Registrar pagos a trabajadores | ✔ |  |  |  |  |  | ✔ |  |
| `pago:ver` · Consultar pagos de clientes | ✔ |  | ✔ | ✔ |  |  | ✔ |  |
| `pedido:crear` · Registrar pedidos | ✔ |  | ✔ |  |  |  |  |  |
| `pedido:ver` · Consultar pedidos | ✔ |  | ✔ | ✔ |  |  |  |  |
| `planificacion:administrar` · Programar actividades y proyecciones de cosecha | ✔ | ✔ |  |  |  |  |  |  |
| `planificacion:ver` · Consultar la planificación agrícola | ✔ | ✔ |  | ✔ |  |  |  | ✔ |
| `proceso:administrar` · Configurar flujos de proceso y etapas | ✔ |  |  |  |  |  |  |  |
| `proceso:registrar` · Registrar etapas de beneficio y poscosecha | ✔ | ✔ |  |  |  | ✔ |  |  |
| `proceso:ver` · Consultar procesos de beneficio y poscosecha | ✔ | ✔ |  | ✔ |  | ✔ |  | ✔ |
| `producto:administrar` · Crear y modificar productos | ✔ |  |  |  |  |  |  |  |
| `producto:ver` · Consultar productos | ✔ | ✔ | ✔ | ✔ |  | ✔ |  |  |
| `proveedor:administrar` · Crear y modificar proveedores | ✔ |  |  |  |  |  | ✔ |  |
| `proveedor:ver` · Consultar proveedores | ✔ | ✔ |  | ✔ |  | ✔ | ✔ |  |
| `reporte:ver` · Consultar reportes | ✔ | ✔ | ✔ | ✔ |  |  | ✔ | ✔ |
| `tarifa:modificar` · Crear versiones de tarifas | ✔ |  |  |  |  |  |  |  |
| `tarifa:ver` · Consultar tarifas | ✔ |  | ✔ | ✔ |  |  | ✔ |  |
| `trabajador:administrar` · Crear trabajadores y vinculaciones | ✔ |  |  |  |  |  |  |  |
| `trabajador:ver` · Consultar trabajadores | ✔ | ✔ |  | ✔ |  |  | ✔ | ✔ |
| `trabajador:ver_propio` · Consultar los propios datos, acumulados, anticipos y saldos |  |  |  |  | ✔ |  |  |  |
| `trabajo:registrar` · Registrar producción o jornadas de trabajadores | ✔ | ✔ |  |  |  |  |  | ✔ |
| `trabajo:registrar_propio` · Registrar la propia producción |  |  |  |  | ✔ |  |  |  |
| `trabajo:validar` · Validar o rechazar registros de producción | ✔ | ✔ |  |  |  |  |  | ✔ |
| `trazabilidad:ver` · Consultar la trazabilidad de una venta o lote | ✔ | ✔ | ✔ | ✔ |  | ✔ |  | ✔ |
| `usuario:administrar` · Crear usuarios y asignar roles | ✔ |  |  |  |  |  |  |  |
| `usuario:ver` · Consultar usuarios | ✔ |  |  |  |  |  |  |  |
| `venta:anular` · Anular ventas | ✔ |  |  |  |  |  |  |  |
| `venta:crear` · Registrar ventas | ✔ |  | ✔ |  |  |  |  |  |
| `venta:descontar` · Aplicar descuentos autorizados en una venta (hasta el máximo configurado) | ✔ |  | ✔ |  |  |  |  |  |
| `venta:ver` · Consultar ventas | ✔ |  | ✔ | ✔ |  |  | ✔ |  |

Además del permiso, todo acceso se limita por **organización** y por las **fincas asignadas** al usuario (`usuario_finca`). Se pueden dar permisos extra a un usuario concreto (`usuario_permiso_extra`).

Roles de extensión (supervisor de campo, recolector, bodega, financiero, auditor): diseñados en el prompt maestro; su estado de implementación se indica en la matriz de trazabilidad.
