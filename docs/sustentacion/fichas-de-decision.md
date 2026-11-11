# Fichas de decisión para la sustentación

Cada integrante defiende **un driver y su ADR**. Las cuatro preguntas del profesor (sección 1.7 del Driver) están respondidas en lenguaje simple. Los números salen del [informe de pruebas](../pruebas/informe-de-pruebas.md); si una cifra cambia al volver a medir, cambia allá primero.

> **Advertencia para el equipo.** El profesor dice que la documentación escrita por IA se nota en treinta segundos cuando describe decisiones que el equipo no tomó. Estas fichas están escritas para que cada integrante **las lea, las discuta, las corrija con sus palabras y compruebe cada afirmación en el código**. Las decisiones técnicas concretas (sesiones propias con Argon2id, `pg` directo sin ORM, Zod, bloqueo pesimista) fueron **propuestas del asistente**; antes de defenderlas, cada integrante debe poder explicar por qué las acepta o qué cambiaría.

| Integrante | Driver | ADR que defiende | Quién (completar) |
|---|---|---|---|
| 1 | D1 · Consistencia del inventario | ADR-002 Control de concurrencia | ______ |
| 2 | D2 · Trazabilidad | ADR-001 Estilo arquitectónico (monolito modular por capas) | ______ |
| 3 | D3 · Seguridad y control de acceso + conectividad rural | ADR-003 Fuera de línea vs. consistencia | ______ |

---

## Ficha 1 · D1 Consistencia del inventario — ADR-002

**La decisión en una frase.** Una venta se registra en **una sola transacción** que bloquea las filas de existencias con `SELECT … FOR UPDATE`, comprueba que alcance y descuenta; la base además tiene `CHECK (cantidad >= 0)` y una clave de idempotencia por venta.

**Cómo funciona (para explicarlo sin leer).** Si dos personas venden los mismos 60 kg a la vez, la base obliga a que una espere a la otra: la primera ve 60, vende 50 y deja 10; la segunda recién entonces lee 10 y recibe "Existencias insuficientes". Nadie lee un saldo mientras otro lo está cambiando. Si la red se corta y el cliente reenvía la misma venta, la clave de idempotencia hace que el servidor devuelva la venta original en vez de crear otra.

**1. ¿Qué driver justifica esta decisión y de dónde salió?** D1 está en el Driver.docx del profesor: "las ventas nunca pueden superar las existencias, incluso con varios usuarios". Es el atributo más importante y más difícil del árbol de utilidad (A, A): un saldo negativo es plata y café que no existen.

**2. ¿Qué alternativa descartaron y por qué?** *Control optimista con versión:* con 50 solicitudes sobre la misma fila, 49 fallan y reintentan; justo en el caso del escenario QA-01 hay tormenta de reintentos. *`SERIALIZABLE`:* la base aborta transacciones y la aplicación debe reintentar, con latencias impredecibles. *Reserva en dos pasos:* añade estados y un proceso que libere reservas vencidas. *Bloqueos asesores:* viven fuera del modelo de datos. (Detalle en ADR-002.)

**3. ¿Qué atributo empeoró y por qué es aceptable?** El **rendimiento bajo contención**: las ventas sobre el mismo saldo se **serializan**; cada una espera a la anterior. Es aceptable porque la contención real de una finca es baja y es el precio de la corrección. Se midió: 50.000 solicitudes simultáneas (QA-01) con p95 de **109 ms** por solicitud en local, muy por debajo de la meta de 1,5 s.

**4. Si el negocio creciera diez veces, ¿qué se rompe primero?** El **límite de conexiones de PostgreSQL**: cada venta con transacción abierta ocupa una conexión, y Render Free no tiene pool administrado. La aplicación usa un pool de 5 conexiones por instancia. La métrica que lo muestra es la latencia p95 y la tasa de errores al subir los usuarios simultáneos: ver QA-11 (punto de quiebre medido). Después, la **contención sobre una misma fila** si todos venden el mismo lote.

**Pruebas que lo respaldan.** `tests/concurrencia/ventas-concurrentes.test.ts` (QA-01: 1.000 rondas × 50 solicitudes, 0 saldos negativos; QA-02: 500 reintentos, 0 duplicados), `finanzas.test.ts` (5 pagos simultáneos por el saldo completo: solo uno entra), `anulaciones-y-derechos.test.ts` (anulaciones simultáneas compensan una sola vez).

**Una lección real del proyecto (para contarla).** Al probar pagos de clientes, la prueba de concurrencia mostró que 3 de 5 pagos simultáneos pasaban: la suma de pagos dentro del mismo `SELECT … FOR UPDATE` se leía con una instantánea anterior al bloqueo. Se corrigió bloqueando primero y sumando después en otra consulta. Sin la prueba de concurrencia no se habría visto.

---

## Ficha 2 · D2 Trazabilidad — ADR-001 (monolito modular por capas)

**La decisión en una frase.** Todo corre en **un solo proceso y una sola base de datos**, organizado en módulos por contexto y capas (presentación → aplicación → dominio ← infraestructura), con una regla automática que prohíbe saltarse capas.

**Cómo se relaciona con D2.** La trazabilidad (cosecha → lote → transformación → producto → venta) depende de que la venta, el movimiento de inventario y el lote de origen se graben **juntos o no se graben**. Con un solo proceso y una sola base, esa unidad de trabajo es una transacción normal. Con microservicios habría que coordinar varios servicios (transacciones distribuidas o eventos) y la trazabilidad quedaría "eventualmente consistente", que es justo lo contrario de lo que pide el driver.

**1. ¿Qué driver justifica esta decisión y de dónde salió?** D2 (Driver.docx: "trazabilidad cosecha → lote → transformación → producto → venta") y D1, porque el mismo argumento de atomicidad sirve a los dos. También pesan las restricciones: equipo de 3, presupuesto cero y planes gratuitos (C-04, C-05).

**2. ¿Qué alternativa descartaron y por qué?** *Microservicios:* costo operativo y de coordinación desproporcionado para tres personas y para dos planes gratuitos; rompe la transacción única. *Arquitectura orientada a eventos:* consistencia eventual, difícil de probar y de defender para inventario. *Monolito sin estructura:* se descartó por mantenibilidad (QA-13).

**3. ¿Qué atributo empeoró y por qué es aceptable?** La **escalabilidad independiente** de cada módulo (no se puede escalar solo "ventas") y la **disciplina**: sin la regla de capas, un monolito se degrada. Es aceptable porque no hay evidencia de que algún módulo necesite escalar por separado y la disciplina la impone `npm run capas` en CI (QA-13: se probó creando un atajo a propósito).

**4. Si el negocio creciera diez veces, ¿qué se rompe primero?** La **tabla de movimientos**: es inmutable y solo crece. Con 100.004 movimientos y 10.000 cosechas la consulta de trazabilidad respondió con p95 de **7 ms** (QA-03), así que la consulta aguanta; lo que llega antes a un límite es el **tamaño de la base frente al 1 GB** de Render Free, y la lista de cosechas por lote, que hoy se muestra completa. La respuesta sería archivar movimientos antiguos o particionar por fecha.

**Limitación que hay que decir en voz alta.** La trazabilidad es **por lote**, no por kilo: sabemos de qué lote(s) salió lo vendido y por qué etapas pasó ese lote, pero no qué kilo exacto de ese lote. Seguir cada kilo exigiría identificar unidades físicas.

**Pruebas que lo respaldan.** `ventas.test.ts` (trazabilidad de una venta), `beneficio.test.ts` (la cadena cereza → pergamino → excelso aparece en la trazabilidad), `trazabilidad-volumen.test.ts` (QA-03), `seguridad-y-base.test.ts` (QA-04: la base rechaza cosechas huérfanas), `npm run capas` y `capas:probar` (QA-13).

---

## Ficha 3 · D3 Seguridad y control de acceso (+ conectividad) — ADR-003

**La decisión en una frase.** Fuera de línea solo se capturan operaciones que **no comprometen existencias** (cosechas, producción de trabajadores, inspecciones); cada una lleva un identificador único y se sincroniza con reintentos. Las ventas y las salidas de inventario **nunca** se confirman sin conexión. Y todo —también lo que llega de la cola— pasa por la autorización del servidor.

**Cómo se relaciona con D3.** Una cola local podría ser una puerta trasera. No lo es porque la cola solo *propone*: cada operación llega al mismo caso de uso que usa la pantalla, que comprueba sesión, permiso, finca y reglas. Si el usuario ya no tiene permiso, la operación se rechaza y queda en la cola como **rechazada** con su motivo (no se pierde).

**1. ¿Qué driver justifica esta decisión y de dónde salió?** Dos: D3 (seguridad y control de acceso, del Driver.docx) y la restricción de **conectividad rural limitada**, que choca con D1. El ADR-003 documenta ese choque.

**2. ¿Qué alternativa descartaron y por qué?** *Todo fuera de línea con fusión de conflictos* (por ejemplo PouchDB/RxDB): para ventas obligaría a aceptar una venta local que el servidor luego rechaza porque no había existencias, y eso viola D1. *Todo en línea:* inutilizable en campo sin señal. *Reservas locales de inventario:* complejas y con riesgo de sobreventa.

**3. ¿Qué atributo empeoró y por qué es aceptable?** La **inmediatez**: un registro de campo no es "confirmado" hasta que el servidor lo acepta, y el sistema lo muestra como **pendiente**. Es aceptable porque lo que se captura así (una cosecha ya ocurrida) no depende de existencias ajenas. En seguridad, el costo es **más código propio** (sesiones, CSRF, RBAC, bloqueo por intentos) frente a una librería como Auth.js; se aceptó para tener RBAC en la base y auditar cada intento.

**4. Si el negocio creciera diez veces, ¿qué se rompe primero?** En la sincronización, **la ráfaga de reconexión**: muchos dispositivos enviando su cola a la vez contra un pool de 5 conexiones. QA-08 midió 50 operaciones sincronizadas en 0,8 s en red local, pero la medición relevante es con muchos dispositivos a la vez: ver QA-11. En seguridad, la **tabla de auditoría** crecería rápido; habría que indexar por fecha (ya existe) y archivar.

**Medidas de seguridad que se pueden demostrar en vivo.** El mismo usuario sin permiso recibe 403 y queda auditado (QA-05); 5 intentos fallidos bloquean la cuenta con respuesta genérica (QA-06); un usuario de la finca 2 no ve datos de la finca 1 (QA-07); cambiar el rol de un usuario cierra sus sesiones; la auditoría no contiene contraseñas.

**Pruebas que lo respaldan.** `seguridad-y-base.test.ts` (QA-06 y token/Argon2id), `flujos.spec.ts` (QA-05 con API directa y cookie httpOnly), `calidad.spec.ts` (QA-08, QA-15, reportes con permisos), `administracion.test.ts`, `anulaciones-y-derechos.test.ts` (Ley 1581).

---

## Preguntas trampa que conviene ensayar
| Pregunta | Respuesta honesta |
|---|---|
| "¿Funciona con 1.000 usuarios?" | No se afirma. Se midió hasta el punto de quiebre en local (QA-11) y el primer componente que falla es el pool de conexiones de PostgreSQL. En Vercel + Render no se ha medido a esa escala |
| "¿Es seguro?" | Tiene medidas probadas contra los escenarios QA-05, 06 y 07; no se afirma seguridad absoluta |
| "¿Esto es un software de nómina / facturación DIAN?" | No. Es gestión interna: no calcula prestaciones, seguridad social ni retenciones, y los comprobantes son internos |
| "¿Por qué `pg` y no un ORM?" | Las partes críticas (`FOR UPDATE`, `EXCLUDE`, triggers) son SQL de todos modos; la decisión se cambió al implementar y se actualizó el ADR |
| "¿Qué no terminaron?" | [`trabajo-futuro.md`](../trabajo-futuro.md) lo lista sin maquillaje |
