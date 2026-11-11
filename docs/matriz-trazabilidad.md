# Matriz de trazabilidad

Cada fila une un requisito con su origen, el driver, el módulo, la decisión arquitectónica, la entidad principal, la regla de negocio, la prueba que lo verifica, la justificación y lo que se sacrificó. **Estado** dice la verdad sobre lo construido: *Implementado* (hay código y prueba), *Parcial* (lo que falta está en la columna Sacrificio o en [`trabajo-futuro.md`](trabajo-futuro.md)) o *Futuro* (no se construyó).

Origen: **original** = del Driver.docx del profesor; **derivado** = se deduce de un requisito original; **propuesto** = lo agregó el equipo o el prompt maestro. Fecha de corte: 2026-11-11.

## 1. Núcleo (requisitos originales del Driver)

| ID | Requisito | Origen | Driver | Módulo | Decisión | Entidad | Regla de negocio | Prueba | Justificación | Sacrificio | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| N-01 | Fincas y lotes | original | D2 | produccion | ADR-001 monolito modular | `finca`, `lote` | Código de lote único por finca; el creador de una finca queda con acceso y bodega | `fincas-lotes.test.ts` | Base de la trazabilidad | Sin mapa ni linderos (ver C-05) | Implementado |
| N-02 | Cosechas ligadas a su lote, con fecha y cantidad | original | D2 | produccion | Claves foráneas compuestas `(lote_id, finca_id)` | `cosecha` | Sin lote o con lote de otra finca se rechaza en la aplicación y en la BD | `seguridad-y-base.test.ts` QA-04 | La BD se defiende aunque el código falle | Una cosecha anulada se compensa, no se borra | Implementado |
| N-03 | Inventario basado en movimientos | original | D1/D2 | inventario | Movimientos inmutables + saldo como proyección | `movimiento_inventario`, `saldo_inventario` | `CHECK (cantidad >= 0)`; triggers impiden UPDATE/DELETE de movimientos | `seguridad-y-base.test.ts`, `operaciones-inventario.test.ts` | Reconstruir cualquier existencia | La tabla crece sin parar (1 GB en Render Free) | Implementado |
| N-04 | Ventas que nunca superan las existencias, aun con concurrencia | original | D1 | comercial + inventario | ADR-002 `SELECT … FOR UPDATE` + idempotencia | `venta`, `venta_detalle`, `saldo_inventario` | Venta y descuento en una transacción; segunda venta rechazada con mensaje claro | `ventas-concurrentes.test.ts` (QA-01, QA-02) | Corrección fuerte y explicable | Ventas sobre el mismo saldo se serializan | Implementado |
| N-05 | Trazabilidad cosecha → lote → transformación → producto → venta | original | D2 | trazabilidad (lectura) | Consulta recursiva hacia atrás sobre transformaciones del lote | `transformacion_linea`, `venta_detalle` | 100 % de ventas con lote de origen | `ventas.test.ts`, `beneficio.test.ts`, `trazabilidad-volumen.test.ts` (QA-03) | Auditar el origen de una venta | **Nivel de lote, no de kilo individual** (límite documentado) | Implementado (con ese límite) |
| N-06 | Los tres roles originales con permisos comprobados en el servidor | original | D3 | identidad | RBAC en BD; `autorizar()` en cada caso de uso | `rol`, `permiso`, `usuario_rol` | Sin permiso → 403, sin ejecutar nada y con auditoría | `seguridad-y-base.test.ts`, `flujos.spec.ts` (QA-05) | Ocultar botones no es seguridad | Más código de seguridad que mantener | Implementado |
| N-07 | Auditoría de operaciones sensibles | original | D3 | auditoria | Tabla append-only con triggers | `auditoria` | No se edita ni se borra; sin contraseñas ni datos personales | `seguridad-y-base.test.ts`, `administracion.test.ts` | Responsabilidad y forense | Crece con el uso | Implementado |
| N-08 | Protección de datos personales (Ley 1581) | original | D3 | comercial, talento, identidad | Autorización obligatoria + derechos del titular | `cliente`, `trabajador` | Sin autorización no se registra; supresión por anonimización | `anulaciones-y-derechos.test.ts`; ver [`proteccion-datos.md`](proteccion-datos.md) | Cumplimiento legal de la restricción C-01 | No guarda el soporte firmado; no cifra campos | Parcial |
| N-09 | Captura de cosechas con conectividad limitada | original | Conectividad | cliente (PWA) | ADR-003 cola local + idempotencia | cola IndexedDB, `cosecha` | Pendiente nunca se muestra como confirmada; UUID evita duplicados | `flujos.spec.ts`, `calidad.spec.ts` (QA-08) | Rural sin señal | Menor inmediatez | Implementado |

## 2. Extensiones

| ID | Requisito | Origen | Driver | Módulo | Decisión | Entidad | Regla de negocio | Prueba | Sacrificio | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| E-01 | Roles adicionales (supervisor, recolector, bodega, financiero, auditor) | derivado | D3 | identidad | Roles y permisos como datos (migración 0003) | `rol`, `rol_permiso` | El recolector solo ve y registra lo propio; el auditor no tiene permisos de escritura | `talento.test.ts`, `administracion.test.ts`, `calidad.spec.ts` | Roles de extensión marcados `es_extension` | Implementado |
| E-02 | Trabajadores, vinculaciones y modalidades de pago por kg, arroba, jornada y actividad | derivado | D2/D3 | talento | Modalidad por vinculación; tarifa por trabajador > finca > general | `trabajador`, `vinculacion`, `tarifa` | Vinculaciones de un trabajador en una finca no se solapan | `talento.test.ts` | La modalidad "otras" del prompt no está | Implementado (parcial en "otras") |
| E-03 | Producción individual declarada → validada → liquidada → pagada | derivado | D2 | talento | Estados explícitos; valor calculado por el sistema | `registro_trabajo` | El trabajador no define el valor; nadie valida lo propio | `talento.test.ts`, `calidad.spec.ts` | Una validación por registro | Implementado |
| E-04 | Liquidación con anticipos y pagos, con tarifas históricas | derivado | D1 (idempotencia) | talento | Liquidación inmutable; pagos inmutables | `liquidacion`, `anticipo`, `pago_trabajador` | Un registro se liquida una vez; pago ≤ saldo; autoliquidación prohibida | `talento.test.ts`, `remuneracion.test.ts` | No es nómina legal (sin prestaciones ni retenciones) | Implementado |
| E-05 | Beneficio y poscosecha con flujos configurables | propuesto | D2 | beneficio | Cada etapa es una transformación de inventario | `proceso_tipo`, `proceso_etapa`, `proceso_registro` | Merma sobre la esperada exige justificación | `beneficio.test.ts` | Etapas de una sola entrada por registro en la UI (3 etapas al crear flujo) | Implementado |
| E-06 | Compras: proveedores, pedidos, recepciones, cuentas por pagar | propuesto | — | finanzas | Pedido → recepción → pago; pagos inmutables | `compra`, `proveedor`, `pago_proveedor` | Solo se paga lo recibido; pago ≤ saldo | `finanzas.test.ts` | Los insumos no entran al inventario físico | Implementado |
| E-07 | Finanzas: gastos, cartera, flujo de caja y conciliación | propuesto | — | finanzas, comercial | Base devengada + flujo de caja; conciliación interna | `gasto`, `pago_cliente` | Movimientos financieros separados de los físicos | `finanzas.test.ts` | No es contabilidad oficial ni conciliación bancaria | Implementado |
| E-08 | Sanidad: inspecciones, agroquímicos con vencimiento, aplicaciones, registros ambientales | propuesto | D2 | agricola | Stock con bloqueo de fila y movimientos inmutables | `inspeccion`, `agroquimico_stock`, `aplicacion_agroquimica` | No se aplica producto vencido ni más de lo disponible | `agricola.test.ts` | Envases y residuos solo como registro libre | Implementado |
| E-09 | Planificación agrícola y proyección de cosecha | propuesto | — | agricola | Proyección contrastada con cosechas reales | `actividad_programada`, `proyeccion_cosecha` | Una actividad se cierra una sola vez | `agricola.test.ts` | Sin calendario gráfico | Implementado |
| E-10 | Maquinaria: equipos, uso, mantenimientos y costos | propuesto | — | agricola | El costo se carga como gasto vía la aplicación de finanzas | `equipo`, `uso_equipo`, `mantenimiento` | Equipo en mantenimiento no se usa | `agricola.test.ts` | Calibraciones solo como tipo de mantenimiento | Implementado |
| E-11 | Pagos de clientes, cartera y descuentos autorizados | derivado | D1 | comercial | Pagos con idempotencia; descuento limitado por parámetro | `pago_cliente`, `venta_detalle.descuento` | Pago ≤ saldo; descuento ≤ máximo configurado | `finanzas.test.ts`, `anulaciones-y-derechos.test.ts` | Sin notas de crédito | Implementado |
| E-12 | Anulación de ventas y cosechas con reverso | derivado | D1/D2 | comercial, produccion, inventario | `reversarEnTransaccion`; nunca se borra | `movimiento_inventario` (reverso) | No se anula lo ya usado ni una venta con pagos | `anulaciones-y-derechos.test.ts` | Venta con pagos exige resolver el cobro antes | Implementado |
| E-13 | Captura sin conexión de producción de trabajadores e inspecciones | derivado | Conectividad | cliente (PWA) | Cola generalizada con endpoints idempotentes | cola IndexedDB | Las ventas nunca se encolan | `calidad.spec.ts` (cola) | Las actividades programadas no se capturan sin conexión | Parcial |
| E-14 | Reportes en CSV generados en el servidor | propuesto | D3 | api/reportes | Reutiliza los casos de uso (permiso y finca) | — | Fórmulas neutralizadas; solo fincas del usuario | `csv.test.ts`, `calidad.spec.ts` (acceso por rol) | PDF no implementado | Parcial |

## 3. Configuración dinámica, seguridad e interfaz

| ID | Requisito | Origen | Módulo | Regla / decisión | Prueba | Sacrificio | Estado |
|---|---|---|---|---|---|---|---|
| C-01 | Tarifas versionadas, sin solapamiento y sin reescribir el pasado | original | configuracion | `EXCLUDE USING gist`; la venta guarda precio y versión | `tarifas.test.ts` (QA-12) | — | Implementado |
| C-02 | Unidades, equivalencias (arroba, carga, saco) como parámetros con vigencia | prompt §6 | configuracion | Factor por ámbito (general/finca) y vigencia; nueva cierra la anterior | `administracion.test.ts` | Valores DEMO "Parcial" (fuente por confirmar) | Implementado |
| C-03 | Catálogos, temporadas y parámetros operativos | prompt §6 | configuracion | Valor y rango validados; cambio auditado con valor anterior | `administracion.test.ts` | Las temporadas no se enlazan a tarifas por temporada en la UI | Parcial |
| C-04 | Administración de usuarios, roles y permisos | prompt §7 | identidad | Cambios cierran sesiones; último administrador protegido | `administracion.test.ts` | — | Implementado |
| C-05 | Caracterización de la finca (linderos, vías, agua, mapa) y detalle de cultivos (densidad, zoca, historial) | prompt §9 | produccion | Solo nombre, ubicación, área, variedad, árboles, estado | — | No construido | Futuro |
| C-06 | Seguridad: Argon2id, cookie httpOnly/Secure/SameSite, fuerza bruta, CSRF, validación, secretos en entorno | original | identidad | Sesiones propias, token solo como hash | `seguridad-y-base.test.ts`, `flujos.spec.ts` | Más código propio | Implementado |
| C-07 | Home con carrusel e imágenes según la tabla 15.1; diseño responsive de 5 tamaños | prompt §15 | app | Mobile-first; imágenes `-sm` en celular | `responsive.spec.ts` (QA-16) | Imágenes ilustrativas generadas con IA | Implementado |
| C-08 | Rendimiento del home (LCP, CLS, Lighthouse) | prompt §17 | app | Solo la primera imagen con prioridad | informe QA-09 | Ver informe | Ver informe |
| C-09 | Capas sin atajos (verificado en CI) | prompt §5 | todo | dependency-cruiser | `npm run capas`, `capas:probar` (QA-13) | — | Implementado |
| C-10 | Despliegue en Vercel + Render y estrategia de recuperación | prompt §16 | — | Ver [`despliegue.md`](despliegue.md) | QA-14 | Render Free expira a los 30 días y no tiene respaldos | Ver despliegue |

## 4. Reglas finales del prompt (§22): cómo se cumplen
| Regla | Cómo |
|---|---|
| No hardcodear tarifas ni parámetros | Tarifas, equivalencias, catálogos y parámetros están en tablas; los valores DEMO están marcados |
| Los trabajadores no modifican sus tarifas | El rol recolector no tiene permisos de tarifas; pruebas en `talento.test.ts` |
| No mezclar producción con liquidaciones ni pagos | `registro_trabajo` ≠ `liquidacion` ≠ `pago_trabajador`, con estados y servicios separados |
| No confundir movimientos físicos con financieros | Inventario y finanzas son módulos distintos; el costo de mantenimiento pasa por la aplicación de finanzas |
| No borrar movimientos ni trazabilidad | Triggers de inmutabilidad; las correcciones son reversos auditados |
| No crear permisos solo visuales | Cada caso de uso llama a `autorizar()`; hay pruebas de 403 por rol y por finca |
| No documentar una arquitectura distinta a la implementada | Los documentos se alinearon con el código (ADR-002, tecnologías, contextos); `capas` verifica el estilo |
