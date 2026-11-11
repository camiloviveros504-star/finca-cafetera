# ADR-003 · Operación sin conexión frente a consistencia del inventario

## 1. Título y estado
**Solo se capturan sin conexión las operaciones que no comprometen existencias (cosechas, actividades, inspecciones); ventas, reservas y salidas exigen conexión y confirmación del servidor.** Estado: **Aceptado** (2026-11-10). Responsable de la defensa: integrante asignado a la restricción de conectividad y al driver D2.

## 2. Contexto
La restricción **C-02** del Driver (conectividad limitada en zonas rurales) choca con el driver **D1**: si una venta se confirmara en un dispositivo sin señal, dos dispositivos podrían vender las mismas existencias sin enterarse. Por otro lado, el recolector necesita registrar su cosecha en el lote aunque no haya red (QA-08, QA-15).

Una cosecha registrada **aumenta** existencias; no puede dejar el inventario negativo. Una venta o salida **disminuye** existencias, y ahí vive el riesgo de D1.

## 3. Decisión
1. **Offline permitido solo para operaciones que no restan existencias:** cosechas, actividades agrícolas e inspecciones.
2. **Offline prohibido para:** ventas, reservas, salidas, traslados y pagos. Requieren conexión y confirmación del servidor; el botón se bloquea o avisa cuando no hay red.
3. **Cola local en IndexedDB.** Cada operación nace en el cliente con un **UUID** que es su clave de idempotencia. Se reintenta con espera creciente al recuperar la red.
4. **Duplicados:** el servidor tiene un índice único sobre la clave; un reintento devuelve el resultado original.
5. **Estados visibles:** *pendiente* (en el dispositivo, aún no confirmada), *sincronizada*, *rechazada* (con el motivo). Nunca se muestra una operación pendiente como confirmada.
6. **Regla de conflictos:** las cosechas son hechos nuevos, no ediciones de un registro compartido, así que no se pisan entre sí. Al sincronizar, el servidor revalida que el usuario aún tenga permiso sobre la finca y el lote, y que el lote exista. Si falla, la operación se marca *rechazada* y el usuario puede corregirla; el servidor no la modifica en silencio.
7. **Fecha:** se guardan la fecha de captura (del dispositivo) y la fecha de recepción (del servidor). Las existencias se actualizan con la fecha de recepción.
8. **La cosecha pendiente no cuenta en el inventario** hasta que se sincroniza y se confirma.

## 4. Alternativas descartadas y por qué

| Alternativa | Por qué se descartó |
|---|---|
| **Offline completo, incluidas ventas, con reservas locales de existencias** | Rompe D1: los saldos locales pueden estar desactualizados y dos dispositivos venderían lo mismo. Reconciliar después significa deshacer ventas ya prometidas a clientes. |
| **Solo en línea, sin cola local** | Ignora C-02: en zonas sin señal el recolector pierde el registro o lo anota en papel y lo digita después, con riesgo de errores y de duplicados. |
| **Biblioteca de sincronización con resolución automática de conflictos (por ejemplo PouchDB, RxDB o un CRDT)** | Añade dependencias pesadas y un servidor de sincronización, y el objetivo (cosechas como hechos nuevos) no necesita fusionar ediciones. Es demasiada maquinaria para un caso sin conflictos reales. |
| **Solo Background Sync del navegador** | No está disponible en todos los navegadores móviles (por ejemplo, Safari en iPhone). Se usa como mejora opcional; la sincronización principal ocurre al abrir la aplicación y al volver la red. |

## 5. Consecuencias

**Positivas**
- D1 queda intacto: ninguna operación que reste existencias se confirma sin el servidor.
- El recolector puede trabajar sin señal y no pierde cosechas (QA-08).
- Sin duplicados gracias a la clave de idempotencia.

**Negativas (y por qué se aceptan)**
- **Inmediatez reducida:** una cosecha pendiente no suma al inventario hasta sincronizar, así que un responsable comercial puede no ver ese café disponible. Es preferible a ofrecer café que no existe en el servidor.
- **Una cosecha puede ser rechazada tras sincronizar** (por ejemplo, si se retiró el permiso al lote). Hay que mostrar el rechazo y permitir corregirlo.
- **Reloj del dispositivo:** la fecha de captura puede estar mal. Se guarda la fecha de recepción y se marca la diferencia grande.
- **Pérdida de datos locales:** si el usuario borra los datos del navegador con operaciones pendientes, se pierden. Se avisa con claridad, y se reduce el riesgo con el indicador de pendientes siempre visible.
- **Ventas sin señal no son posibles.** Se acepta: es lo que D1 exige.
- **Más superficie de pruebas:** reconexión, duplicados y rechazos (riesgo R-03).
