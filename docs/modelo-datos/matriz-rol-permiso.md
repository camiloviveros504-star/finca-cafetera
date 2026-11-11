# Matriz rol-permiso

> Generada con `npx tsx db/matriz.ts` desde la base. Los permisos se comprueban en el servidor, en la capa de aplicación de cada caso de uso.

| Permiso | Administrador | Encargado de producción | Responsable comercial |
|---|:-:|:-:|:-:|
| `auditoria:ver` · Consultar la auditoría | ✔ |  |  |
| `bodega:administrar` · Crear y modificar bodegas | ✔ |  |  |
| `cliente:administrar` · Crear y modificar clientes | ✔ |  | ✔ |
| `cliente:ver` · Consultar clientes | ✔ |  | ✔ |
| `configuracion:modificar` · Modificar configuración, unidades y equivalencias | ✔ |  |  |
| `configuracion:ver` · Consultar configuración | ✔ |  |  |
| `cosecha:anular` · Anular cosechas (con reverso de inventario) | ✔ |  |  |
| `cosecha:registrar` · Registrar cosechas | ✔ | ✔ |  |
| `cosecha:ver` · Consultar cosechas | ✔ | ✔ |  |
| `finca:administrar` · Crear y modificar fincas | ✔ |  |  |
| `finca:ver` · Consultar fincas | ✔ | ✔ | ✔ |
| `inventario:ajustar` · Registrar ajustes, pérdidas y conteos físicos | ✔ | ✔ |  |
| `inventario:reversar` · Reversar movimientos confirmados | ✔ |  |  |
| `inventario:transformar` · Registrar transformaciones | ✔ | ✔ |  |
| `inventario:trasladar` · Trasladar entre bodegas | ✔ |  |  |
| `inventario:ver` · Consultar existencias y movimientos | ✔ | ✔ | ✔ |
| `lote:administrar` · Crear y modificar lotes | ✔ | ✔ |  |
| `lote:ver` · Consultar lotes | ✔ | ✔ |  |
| `pago:registrar` · Registrar pagos de clientes | ✔ |  | ✔ |
| `pago:ver` · Consultar pagos de clientes | ✔ |  | ✔ |
| `pedido:crear` · Registrar pedidos | ✔ |  | ✔ |
| `pedido:ver` · Consultar pedidos | ✔ |  | ✔ |
| `producto:administrar` · Crear y modificar productos | ✔ |  |  |
| `producto:ver` · Consultar productos | ✔ | ✔ | ✔ |
| `reporte:ver` · Consultar reportes | ✔ | ✔ | ✔ |
| `tarifa:modificar` · Crear versiones de tarifas | ✔ |  |  |
| `tarifa:ver` · Consultar tarifas | ✔ |  | ✔ |
| `trazabilidad:ver` · Consultar la trazabilidad de una venta o lote | ✔ | ✔ | ✔ |
| `usuario:administrar` · Crear usuarios y asignar roles | ✔ |  |  |
| `usuario:ver` · Consultar usuarios | ✔ |  |  |
| `venta:anular` · Anular ventas | ✔ |  |  |
| `venta:crear` · Registrar ventas | ✔ |  | ✔ |
| `venta:ver` · Consultar ventas | ✔ |  | ✔ |

Además del permiso, todo acceso se limita por **organización** y por las **fincas asignadas** al usuario (`usuario_finca`). Se pueden dar permisos extra a un usuario concreto (`usuario_permiso_extra`).

Roles de extensión (supervisor de campo, recolector, bodega, financiero, auditor): diseñados en el prompt maestro; su estado de implementación se indica en la matriz de trazabilidad.
