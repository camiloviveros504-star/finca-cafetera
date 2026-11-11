# 06 · Tácticas aplicadas

Cada táctica dice contra qué escenario actúa y qué atributo degrada. Una táctica sin costo declarado no se acepta.

| # | Táctica | Escenario(s) | Qué mejora | Qué degrada o cuesta |
|---|---|---|---|---|
| T-01 | **Bloqueo de fila** con `SELECT ... FOR UPDATE` sobre los saldos, en orden determinista, dentro de una transacción (ADR-002). | QA-01 | Consistencia: dos ventas no ven el mismo saldo a la vez. | Rendimiento bajo contención: las ventas sobre la misma fila se serializan. Una transacción larga bloquea a las demás. |
| T-02 | **`CHECK (cantidad >= 0)`** en la tabla de saldos como última defensa. | QA-01, QA-11 | Aunque falle el código, la base rechaza un saldo negativo. | Una venta mal programada falla con error de base, que hay que traducir a un mensaje claro. |
| T-03 | **Clave de idempotencia única** por operación sensible (ventas, pagos, cosechas offline). | QA-02, QA-08 | Un reintento devuelve el resultado original y no duplica. | Almacenamiento extra, una consulta más por operación y la necesidad de limpiar claves antiguas. |
| T-04 | **Movimientos inmutables** (solo inserción; correcciones con reverso o ajuste auditado). | QA-03, QA-12 | Trazabilidad e historia confiable. | Crece la tabla de movimientos; corregir un error exige un movimiento nuevo en vez de editar. |
| T-05 | **Claves foráneas obligatorias y clave compuesta (finca, lote)** en cosechas. | QA-04 | Una cosecha sin lote o con lote de otra finca no puede existir, ni siquiera saltándose la aplicación. | Menos flexibilidad: no se puede registrar una cosecha antes de crear el lote. |
| T-06 | **Autorización en la capa de aplicación** con RBAC por operación y recurso, leído de la base. | QA-05 | Ninguna ruta de presentación puede saltarse el permiso. | Simplicidad: cada caso de uso lleva su comprobación; una consulta de permisos por solicitud (se mitiga cargándolos una vez por solicitud). |
| T-07 | **Registro de auditoría append-only** (incluye intentos rechazados). | QA-05, QA-07 | Rastro de quién intentó qué. | Latencia de escritura y almacenamiento; se evita guardar datos sensibles en los valores. |
| T-08 | **Limitación de intentos y bloqueo temporal**, con respuesta genérica. | QA-06 | Frena la fuerza bruta y no revela si el usuario existe. | Usabilidad: un usuario legítimo puede quedar bloqueado; un atacante puede bloquear una cuenta (se limita por cuenta e IP). |
| T-09 | **Filtro obligatorio por organización y finca** en todo repositorio. | QA-07 | Evita fugas entre fincas. | Flexibilidad: no hay consultas "globales" sin pasar por un permiso especial. |
| T-10 | **Cola local en IndexedDB con idempotencia y reintentos** (solo cosechas, actividades, inspecciones). | QA-08 | Disponibilidad en campo sin señal. | Inmediatez: lo pendiente no cuenta en el inventario hasta sincronizar (ADR-003). |
| T-11 | **Imágenes WebP en dos tamaños, primera con prioridad, resto diferidas.** | QA-09 | LCP y peso de página. | Más archivos que mantener; una pequeña complejidad en el carrusel. |
| T-12 | **Paginación en servidor e índices por consulta real.** | QA-10, QA-03 | Respuesta estable con volumen. | Cada índice cuesta espacio y escritura. |
| T-13 | **Pool de conexiones limitado por instancia y transacciones cortas.** | QA-10, QA-11 | Evita agotar las conexiones de Render Free. | Menos concurrencia por instancia; las solicitudes extra esperan. |
| T-14 | **Tarifas versionadas con vigencia y `EXCLUDE` de no solapamiento.** | QA-12 | Cambios de precio sin tocar el histórico. | Más tablas y reglas; cada operación guarda el valor y la versión aplicados. |
| T-15 | **Regla de dependencias automatizada en CI (dependency-cruiser).** | QA-13 | Los atajos entre capas rompen el pipeline. | Fricción para el desarrollador y mantenimiento de las reglas. |
| T-16 | **Migraciones y semillas reproducibles, `pg_dump` antes de la sustentación.** | QA-14 | Recreación de la base en minutos. | Hay que mantener las semillas al día con cada cambio de esquema. |
| T-17 | **Diseño mobile-first y botones de al menos 44 px.** | QA-15, QA-16 | Uso en campo con una mano. | Más trabajo de diseño y pruebas en varios tamaños. |
