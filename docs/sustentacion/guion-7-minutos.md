# Guion de la sustentación: 7 minutos de defensa + 3 de preguntas

Reparto: **3 integrantes, uno por driver** (ver `fichas-de-decision.md`). Cada uno habla unos 2 minutos y 20 segundos. Hablar con sus propias palabras; este guion es la ruta, no un texto para leer. **Las cifras se leen del [informe de pruebas](../pruebas/informe-de-pruebas.md) el día de la sustentación**, no de este guion.

| Min | Quién | Qué | Apoyo en pantalla |
|---|---|---|---|
| 0:00–0:40 | Integrante 1 | **El problema y la forma de la solución.** Una finca cafetera vende café que cosechó; si dos personas venden lo mismo a la vez, el inventario se rompe; si no sabemos de dónde salió el café, no hay confianza; y los datos de personas están protegidos por la Ley 1581. Tres drivers: D1, D2, D3. Más dos restricciones: poca señal en el campo y presupuesto cero (planes gratuitos). | Diagrama C4 nivel 2 (un monolito y una base) |
| 0:40–2:30 | Integrante 1 | **D1 · Consistencia (ADR-002).** Decisión: una transacción, filas bloqueadas, `CHECK >= 0`, idempotencia. Por qué: el escenario QA-01. Qué descartamos (optimista, serializable). Qué empeoró (las ventas sobre el mismo saldo hacen fila). Qué se rompe primero con 10× (conexiones de PostgreSQL). **Mostrar el resultado de QA-01 y QA-11.** | Informe: filas QA-01, QA-02, QA-11 |
| 2:30–3:00 | Integrante 1 → 2 | **Demo en vivo, parte 1** (guion de demo, pasos 1 y 2): permisos y venta rechazada. | Aplicación |
| 3:00–4:50 | Integrante 2 | **D2 · Trazabilidad (ADR-001).** Un solo proceso y una sola base **porque** la trazabilidad necesita que la venta, el movimiento y el lote se graben juntos. Movimientos inmutables; la corrección es un reverso. Qué descartamos (microservicios, eventos). Qué empeoró (escalar un módulo por separado) y cómo se controla la disciplina (`npm run capas`, QA-13). Qué se rompe primero con 10× (tamaño de la tabla de movimientos). **Decir la limitación: trazabilidad por lote, no por kilo.** | Pantalla de trazabilidad; informe QA-03 y QA-13 |
| 4:50–5:20 | Integrante 3 | **Demo en vivo, parte 2** (pasos 3 y 4): cosecha sin conexión y tarifa nueva. | Aplicación |
| 5:20–6:50 | Integrante 3 | **D3 · Seguridad (ADR-003).** RBAC en la base, autorización en el servidor, auditoría, bloqueo por intentos, Ley 1581 (autorización, anonimización). Fuera de línea solo lo que no compromete existencias. Qué descartamos (todo fuera de línea con fusión de conflictos; librería de autenticación). Qué empeoró (inmediatez; más código de seguridad propio). Qué se rompe primero con 10× (ráfaga de reconexión sobre el pool). | Informe QA-05, QA-06, QA-07, QA-08 |
| 6:50–7:00 | Cualquiera | **Cierre honesto.** Qué quedó por hacer (`trabajo-futuro.md`) y que las mediciones locales no son las de Vercel + Render. | `trabajo-futuro.md` |

## Las 3 frases que no se pueden olvidar
1. "Ocultar un botón no es seguridad: el servidor decide, y deja rastro."
2. "No borramos nada: corregimos con un movimiento contrario, para poder reconstruir cualquier existencia."
3. "Lo que medimos, lo decimos con su entorno; lo que no medimos, lo decimos que no lo medimos."

## Preguntas probables (3 minutos) y quién responde
| Pregunta | Responde |
|---|---|
| Las cuatro preguntas del profesor para cualquier decisión | Quien defiende ese driver (ver la ficha) |
| "¿Por qué no usaron un ORM?" | Integrante 1 |
| "¿Qué pasa si se cae la red a mitad de una venta?" | Integrante 1 (idempotencia) |
| "¿Cómo saben de qué cosecha salió un café vendido?" | Integrante 2 |
| "¿Qué no cumple su sistema?" | Cualquiera: `trabajo-futuro.md` y la columna "¿Cumple?" del informe |
| "¿Qué pasa con los datos de un trabajador que pide borrarlos?" | Integrante 3 (anonimización) |
| "¿Qué hicieron ustedes y qué hizo la IA?" | **Todos, con franqueza.** El asistente propuso y escribió gran parte del código y de los documentos; el equipo debe poder explicar y defender cada decisión. No decir que se hizo algo que no se entiende |
