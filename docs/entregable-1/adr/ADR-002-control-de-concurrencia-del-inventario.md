# ADR-002 · Control de concurrencia del inventario

## 1. Título y estado
**Bloqueo pesimista de filas de saldo con `SELECT ... FOR UPDATE`, restricción `CHECK (cantidad >= 0)` e idempotencia por clave única.** Estado: **Aceptado** (2026-11-10). Responsable de la defensa: integrante asignado al driver D1.

## 2. Contexto
**Driver D1.** Escenarios QA-01 (50 solicitudes simultáneas de 50 kg sobre 60 kg: se confirma una, 0 saldos negativos) y QA-02 (reintentos sin duplicados). El inventario se basa en movimientos inmutables y una tabla de saldos por producto, lote y bodega, que es una proyección actualizada en la misma transacción que el movimiento. Una venta puede descontar de varios lotes (FIFO por fecha de cosecha), así que toca más de una fila de saldo.

La base es PostgreSQL con nivel de aislamiento por defecto (READ COMMITTED). Las operaciones críticas usan transacciones explícitas y SQL controlado, sin importar el ORM.

## 3. Decisión
Dentro de **una sola transacción**, la venta:

1. Comprueba la clave de idempotencia (índice único); si ya existe, devuelve el resultado original.
2. Bloquea las filas de saldo candidatas con `SELECT ... FOR UPDATE`, **ordenadas por (fecha de lote, id)** para evitar bloqueos mutuos entre transacciones.
3. Calcula la asignación FIFO con los valores ya bloqueados. Si no alcanza, aborta con el error de negocio "Existencias insuficientes: disponibles X".
4. Inserta los movimientos de salida, actualiza los saldos y crea la venta con sus detalles (precio aplicado y lote de origen).
5. Confirma. Cualquier fallo revierte todo.

La restricción `CHECK (cantidad >= 0)` queda como **red de seguridad**: si algún día el código falla, la base igual rechaza el saldo negativo.

## 4. Alternativas descartadas y por qué

| Alternativa | Por qué se descartó |
|---|---|
| **Control optimista con columna de versión** (leer, calcular, actualizar solo si la versión no cambió; reintentar si cambió) | Con 50 solicitudes sobre la misma fila, 49 fallan y reintentan, lo que genera una tormenta de reintentos y latencias impredecibles justo en el caso de QA-01. Con asignación multilote, un conflicto obliga a recalcular toda la venta. Funciona bien con poca contención; aquí la contención es el escenario. |
| **`UPDATE ... SET cantidad = cantidad - X WHERE cantidad >= X` sin lectura previa** | Es válido y muy simple para una sola fila. Se descartó como mecanismo principal porque la asignación FIFO multilote necesita **leer** los saldos para decidir de qué lotes sacar. Sigue siendo la forma de resolver el caso de un lote explícito si luego se simplifica. |
| **Nivel de aislamiento `SERIALIZABLE`** | Evita la anomalía, pero PostgreSQL aborta transacciones con error de serialización y exige reintentos en la aplicación; con la contención de QA-01 habría muchos abortos y el p95 sería impredecible. |
| **Reserva y confirmación en dos pasos** (reservar existencias con vencimiento y confirmar después) | Añade estados (reservada, vencida, confirmada), un proceso que libere reservas vencidas y más superficie de errores. Se reserva este patrón para pedidos que no se facturan al instante, como trabajo futuro. |
| **Bloqueos asesores (`pg_advisory_lock`)** | Protegen una clave lógica pero quedan fuera del modelo de datos: no se ven en las tablas y no protegen contra otro código que escriba saldos. El bloqueo de fila y el `CHECK` sí viven en la base. |

## 5. Consecuencias

**Positivas**
- Corrección fuerte y fácil de explicar: nadie lee un saldo mientras otra venta lo modifica.
- La segunda venta recibe un mensaje claro y no deja residuos (no hay movimientos de ventas rechazadas).
- La base se defiende sola gracias al `CHECK`, aunque el código tenga un error.
- Funciona igual con cualquier ORM, porque la parte crítica es SQL explícito.

**Negativas (y por qué se aceptan)**
- **Las ventas sobre el mismo saldo se serializan.** Cada venta espera a la anterior; con mucha contención el tiempo de espera crece. Se acepta porque la contención real de una finca es baja y es el precio de que D1 sea correcta. Se mide en QA-01 y QA-11.
- **Una transacción lenta bloquea a las demás.** Se mitiga con transacciones cortas (sin llamadas externas dentro) y un tiempo máximo de bloqueo (`lock_timeout`).
- **Puede haber bloqueo mutuo** si dos transacciones bloquean filas en orden distinto; se evita con el orden determinista y se prueba.
- **Cada conexión con transacción abierta ocupa una conexión de PostgreSQL.** Con Render Free (sin pool administrado) esto limita la concurrencia efectiva; es el primer componente que se espera que falle con diez veces más carga (riesgo R-01).
- **La tabla de movimientos crece sin parar** porque es inmutable; se acepta por trazabilidad (D2) y se vigila el tamaño frente al límite de 1 GB de Render Free.
