# 03 · Escenarios de calidad (QA-01 a QA-16)

**Aviso:** todas las medidas son **metas de diseño**. A 2026-11-10 ninguna se ha medido. Los valores obtenidos se registrarán en `docs/pruebas/` con fecha, comando y entorno (Bloque F). El entorno de referencia es Vercel Hobby + Render Free, salvo que se indique otro. La primera solicitud tras un período inactivo puede tardar más por arranque en frío; se mide y se reporta aparte.

## 1. Los tres escenarios completos (uno por driver original)

### QA-01 · Ventas concurrentes (D1 Consistencia) · (A, A)

**En prosa.** Es temporada de cosecha y la finca tiene 60 kg de pergamino seco del lote L-03 en la bodega principal. Varios responsables comerciales, desde sus celulares y portátiles, registran a la vez ventas de 50 kg de ese mismo producto. El sistema recibe 50 solicitudes simultáneas en operación normal. Debe confirmar exactamente una venta (la primera que obtenga el bloqueo de la fila de existencias) y rechazar las demás con el mensaje "Existencias insuficientes: disponibles 10 kg", sin dejar nunca el saldo por debajo de cero ni crear movimientos de las ventas rechazadas.

| Parte | Contenido |
|---|---|
| Fuente del estímulo | Dos o más responsables comerciales autenticados |
| Estímulo | Registran al mismo tiempo ventas por 50 kg sobre un saldo de 60 kg |
| Artefacto | Caso de uso de venta y tabla de saldos de inventario |
| Entorno | Operación normal, 50 solicitudes concurrentes |
| Respuesta | Se confirma una venta; las demás se rechazan con mensaje claro; no queda ningún movimiento de las rechazadas |
| Medida | 0 saldos negativos en 1.000 ejecuciones concurrentes; confirmación o rechazo en ≤ 1,5 s (p95) |

Táctica asociada: bloqueo de fila con `SELECT ... FOR UPDATE` dentro de una transacción, más `CHECK (cantidad >= 0)` como última defensa (ADR-002). Verificación: prueba de concurrencia contra PostgreSQL real, no contra mocks.

### QA-03 · Consulta de origen de una venta (D2 Trazabilidad) · (A, M)

**En prosa.** Un auditor recibe el reclamo de un cliente sobre un lote de café vendido hace tres meses. Abre la venta y pide su origen. El sistema, con 100.000 movimientos y 10.000 cosechas, debe mostrar la cadena completa: venta → detalle de venta → producto y lote de inventario → transformaciones (por ejemplo pergamino seco → excelso) → cosechas → lotes de cultivo, con fechas y cantidades en cada eslabón. Ninguna venta puede quedar sin lote de origen.

| Parte | Contenido |
|---|---|
| Fuente del estímulo | Auditor o administrador |
| Estímulo | Consulta el origen de una venta |
| Artefacto | Consulta de trazabilidad (caso de uso y repositorio) |
| Entorno | Base con 100.000 movimientos y 10.000 cosechas |
| Respuesta | Muestra venta → producto → transformaciones → cosechas → lotes, con fechas y cantidades |
| Medida | 100 % de las ventas con lote de origen; respuesta ≤ 2 s (p95) |

Táctica asociada: registro inmutable de movimientos con referencia a la operación de origen, claves foráneas desde cada movimiento hacia su cosecha, transformación o venta, e índices por esas referencias. Verificación: consulta con volumen real generado por script y chequeo de "ventas sin origen = 0" en SQL.

### QA-05 · Autorización en servidor (D3 Seguridad) · (A, M)

**En prosa.** Un usuario con el rol de encargado de producción, que está autenticado, copia la petición que hace la pantalla de ventas y la reenvía a mano con una herramienta de pruebas de API, sin pasar por la interfaz, para crear una venta. En otro intento intenta cambiar una tarifa. El sistema debe responder 403 sin ejecutar nada y dejar el intento anotado en la auditoría. Ocultar el botón en la pantalla no cuenta como protección.

| Parte | Contenido |
|---|---|
| Fuente del estímulo | Usuario autenticado sin el permiso requerido |
| Estímulo | Llama directamente a la API para crear una venta o cambiar una tarifa |
| Artefacto | Capa de autorización (permisos por operación y recurso) |
| Entorno | Operación normal, sin pasar por la interfaz |
| Respuesta | Responde 403, no ejecuta la operación y registra el intento en auditoría |
| Medida | 100 % de rechazos en la batería de pruebas de permisos (cada rol × cada operación); auditoría escrita en ≤ 1 s |

Táctica asociada: RBAC con permisos por operación y recurso (`venta:crear`, `tarifa:modificar`) guardados en la base y comprobados en la capa de aplicación de cada caso de uso, de modo que ninguna ruta de presentación pueda saltarlos.

## 2. Tabla completa de escenarios

| ID | Driver / atributo | Fuente | Estímulo | Artefacto | Entorno | Respuesta | Medida |
|---|---|---|---|---|---|---|---|
| QA-01 | D1 Consistencia | Dos o más responsables comerciales | Ventas simultáneas de 50 kg sobre 60 kg | Caso de uso de venta, tabla de saldos | Normal, 50 solicitudes concurrentes | Una confirmada, las demás rechazadas con mensaje claro | 0 saldos negativos en 1.000 ejecuciones; ≤ 1,5 s (p95) |
| QA-02 | D1 Consistencia | Cliente con red inestable | Reenvía la misma venta o pago con la misma clave de idempotencia | API de ventas y pagos | Reintentos por pérdida de respuesta | Se procesa una vez; el reintento devuelve el resultado original | 0 duplicados en 500 reintentos; ≤ 1 s (p95) |
| QA-03 | D2 Trazabilidad | Auditor o administrador | Consulta el origen de una venta | Consulta de trazabilidad | 100.000 movimientos, 10.000 cosechas | Cadena venta → producto → transformaciones → cosechas → lotes | 100 % con lote de origen; ≤ 2 s (p95) |
| QA-04 | D2 Trazabilidad | Encargado de producción | Cosecha sin lote o con lote de otra finca | Caso de uso de cosecha y restricciones de BD | Normal | Rechazo en la aplicación y, si se salta, en la BD | 100 % rechazos; 0 cosechas huérfanas |
| QA-05 | D3 Seguridad | Usuario sin permiso | Llama a la API para crear venta o cambiar tarifa | Capa de autorización | Normal, sin interfaz | 403, sin ejecutar, con registro en auditoría | 100 % rechazos en la batería; auditoría ≤ 1 s |
| QA-06 | D3 Seguridad | Atacante externo | 20 intentos fallidos en 1 minuto | Inicio de sesión | Producción | Bloqueo temporal y respuesta genérica | Bloqueo tras ≤ 5 fallos en 15 min, por 15 min; 0 mensajes que revelen si el usuario existe |
| QA-07 | D3 Seguridad | Usuario de la finca A | Pide datos de la finca B cambiando un id en la URL | Consultas y repositorios | Normal | No devuelve datos ajenos | 0 registros de otra finca en la batería de aislamiento |
| QA-08 | Conectividad limitada | Recolector en campo | Registra 50 cosechas sin señal y luego recupera conexión | Cola local y sincronización | Sin conexión 2 h, luego 3G | Aparecen como pendientes y se sincronizan solas | 0 pérdidas, 0 duplicados; 50 registros en ≤ 60 s tras reconectar |
| QA-09 | Rendimiento (interfaz) | Usuario en celular | Abre el home con el carrusel | Página pública y CDN de Vercel | Gama media, 4G simulada | Primera imagen y texto sin saltos | LCP ≤ 2,5 s, CLS < 0,1, INP ≤ 200 ms; Lighthouse móvil Rendimiento ≥ 85 y Accesibilidad ≥ 95 |
| QA-10 | Rendimiento (servidor) | 50 usuarios simultáneos | Uso mixto 10 min (70 % lecturas, 30 % escrituras) | API y PostgreSQL | Carga sostenida | Responde sin errores | Lecturas ≤ 800 ms, escrituras ≤ 1,5 s (p95); errores < 1 % |
| QA-11 | Escalabilidad | Pico de cosecha | La carga sube hasta que el sistema falla | Todo el sistema | Estrés hasta el quiebre | Se degrada con errores controlados, sin inventario inconsistente | Se documenta el punto de quiebre y el primer componente que falla; 0 saldos negativos |
| QA-12 | Modificabilidad | Administrador | Cambia la tarifa por kg a mitad de temporada | Módulo de tarifas | Producción | La nueva tarifa aplica desde su vigencia; lo anterior conserva su valor | Cambio en ≤ 2 min sin desplegar; 0 registros históricos alterados |
| QA-13 | Mantenibilidad | Desarrollador | Agrega un import que salta capas | Repositorio y CI | Integración continua | El pipeline falla e indica la regla violada | 100 % de violaciones detectadas antes de fusionar |
| QA-14 | Recuperabilidad | Operador | La base de Render expira o se corrompe | Base de datos | Antes de la sustentación | Se recrea con migraciones, semillas y respaldo | Recuperación completa en ≤ 15 min según `docs/despliegue.md` |
| QA-15 | Usabilidad | Recolector con celular | Registra su cosecha del día | Formulario móvil | Campo, una mano, pleno sol | Completa el registro sin ayuda | ≤ 60 s y ≤ 4 pasos; botones ≥ 44 × 44 px |
| QA-16 | Usabilidad (responsive) | Cualquier usuario | Abre los flujos clave en 5 tamaños | Interfaz completa | Tamaños de la sección 15.4 del prompt | Todo se ve completo, sin scroll horizontal | 0 desbordes en 5 tamaños × 5 flujos; 100 % de flujos completables desde 360 px |
