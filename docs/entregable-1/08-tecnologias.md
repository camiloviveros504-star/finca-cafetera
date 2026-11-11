# 08 · Evaluación de tecnologías

Tecnologías fijadas por el prompt: Next.js (App Router) con TypeScript strict, Tailwind CSS, PostgreSQL, Vercel Hobby, Render Free, Git/GitHub con GitHub Actions y Docker para PostgreSQL local. Aquí se compara lo que el prompt pide evaluar. **Las elecciones son propuestas del asistente a 2026-11-10; el equipo debe leerlas y poder defenderlas.**

| Necesidad | Elegida | Descartada | Razón de la elección | Costo aceptado |
|---|---|---|---|---|
| Acceso a datos | **`pg` (node-postgres) con SQL explícito** en repositorios, y migraciones SQL escritas a mano | Drizzle ORM y Prisma | Las partes críticas (`FOR UPDATE`, `EXCLUDE`, `CHECK`, triggers de inmutabilidad, rangos de fechas) son SQL de todos modos y ningún ORM las declara bien en su esquema. Con `pg` el SQL que se defiende en la sustentación es el que se ejecuta, sin capa intermedia, y no hay motor binario. Se cambió la propuesta inicial (Drizzle) al implementar: era una dependencia más sin resolver una necesidad concreta. | Más SQL escrito a mano y sin tipos generados: los repositorios convierten filas a tipos del dominio y las pruebas de integración contra PostgreSQL real cubren los errores de columnas. |
| Validación | **Zod** | Valibot | Es la más conocida en el ecosistema de Next.js y de Server Actions; el equipo puede encontrar ejemplos rápido. El tamaño del paquete importa menos porque la validación crítica corre en el servidor. | Paquete mayor que Valibot en el cliente. |
| Autenticación | **Sesiones propias** con cookie httpOnly y hashing Argon2id (`@node-rs/argon2`) | Auth.js | El sistema necesita RBAC en base de datos, bloqueo por intentos y auditoría de cada intento; con sesiones propias el control es total y hay menos piezas que adaptar. | Más código de seguridad a mantener y probar; hay que acertar con CSRF y expiración. |
| Pruebas unitarias e integración | **Vitest** | Jest | Soporta TypeScript y módulos ES sin configuración extra, y es rápido. | Menos extendido que Jest en proyectos antiguos. |
| Pruebas E2E | **Playwright** | (fijada por el prompt) | Permite emular los 5 tamaños de pantalla y medir desbordes. | Instalación de navegadores. |
| Carga y estrés | **k6** | (fijada por el prompt) | Escenarios escritos en JavaScript con umbrales (p95, tasa de errores). | Binario externo que se instala aparte. |
| Verificación de capas | **dependency-cruiser** | eslint-plugin-boundaries | Reglas de dependencias en un archivo declarativo, con informe y falla en CI; detecta ciclos. | Una herramienta más aparte de ESLint. |
| PWA y cola local | **Service Worker + IndexedDB** escritos a mano | Biblioteca de sincronización (PouchDB, RxDB) | El caso (cosechas como hechos nuevos) no necesita fusión de conflictos; ver ADR-003. | Más código propio en el cliente. |
| Reportes | **Generación en servidor** (CSV; PDF solo si da tiempo) | Generación en el navegador | El servidor ya tiene los datos autorizados y filtrados; evita exponer más información al cliente. | Carga extra de CPU en el servidor. |
| Alojamiento de la base | **Render Free** (fijada por el prompt) | Neon, Supabase | Fijada por el prompt. Neon ofrece una base gratuita sin expiración de 30 días pero con otro modelo de conexión (a verificar); no se usa para no cambiar el plan acordado. | Expira a los 30 días, 1 GB, sin respaldos, sin pool (ver `docs/despliegue.md`). |

Limitaciones de los planes gratuitos: ver [01](01-drivers-y-restricciones.md), restricciones C-04 y C-05, y [la investigación](../investigacion/fase-2-investigacion.md).
