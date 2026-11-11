# 01 · Drivers y restricciones

Fuente: Driver.docx del profesor (transcrito en la sección 1 del prompt maestro). Los tres drivers no se reformulan.

## 1. Drivers originales

| ID | Driver (texto del profesor) | Prioridad | Por qué en ese orden |
|---|---|---|---|
| D1 | **Consistencia del inventario:** no vender más café del disponible, incluso con ventas simultáneas. | 1 | Es el más difícil y el que más condiciona la estructura: obliga a que "validar existencias" y "descontar existencias" ocurran en una sola transacción. Eso empuja a una sola base ACID y descarta repartir inventario y ventas en servicios con bases separadas. |
| D3 | **Seguridad y control de acceso:** cada usuario solo hace las operaciones de su rol; se protege la información de la finca. | 2 | Atraviesa todo el sistema. Define dónde se verifica el permiso (siempre en el servidor) y cómo se aíslan las fincas. Obliga a que ninguna ruta llegue a los datos sin pasar por una capa que autorice. |
| D2 | **Trazabilidad de la producción:** lote de origen, fecha y cantidad de cada cosecha, y relación del café con sus ventas. | 3 | Importante para el negocio, pero se resuelve sobre todo con el modelo de datos (claves foráneas y movimientos inmutables) y no con una estructura especial. Su dificultad es media. |

El orden es una decisión del equipo basada en la dificultad técnica y en cuánto condiciona la arquitectura. No significa que D2 valga menos para el negocio: en el árbol de utilidad sigue siendo de importancia alta.

## 2. Restricciones

Del Driver:

| ID | Restricción | Efecto sobre el diseño |
|---|---|---|
| C-01 | **Protección de datos personales** (Ley 1581 de 2012 y reglamentación; ver `docs/investigacion/fase-2-investigacion.md`, estado "Parcial"). | Minimizar datos personales, registrar finalidad y autorización, no meter datos sensibles en logs ni en auditoría, definir conservación y derechos del titular. |
| C-02 | **Conectividad limitada en zonas rurales.** | Captura offline solo de operaciones que no comprometen existencias, con cola e idempotencia. Choca con D1 (ver ADR-003). |

Del contexto del proyecto:

| ID | Restricción | Efecto sobre el diseño |
|---|---|---|
| C-03 | **Presupuesto cero:** solo planes gratuitos (Vercel Hobby, Render Free). | Nada de brokers de mensajes, colas gestionadas ni servicios adicionales de pago. Un solo despliegue de aplicación y una sola base. |
| C-04 | **Render Postgres Free:** expira a los 30 días, 1 GB, sin respaldos, puede reiniciarse, sin pool de conexiones (verificado en [Render](https://render.com/docs/free)). | Migraciones y semillas reproducibles (`npm run db:reset`), `pg_dump` antes de la sustentación, pool de conexiones limitado por instancia. |
| C-05 | **Vercel Hobby:** uso no comercial; 5.000 transformaciones de imagen al mes (verificado en [Vercel](https://vercel.com/docs/limits/fair-use-guidelines)). | Imágenes ya optimizadas en WebP, dos tamaños, y presupuesto de peso por página. Uso académico únicamente. |
| C-06 | **Funciones serverless:** cada invocación puede abrir conexiones a PostgreSQL. | Pool pequeño por instancia y transacciones cortas. Riesgo documentado (R-01). |
| C-07 | **Equipo de 3 personas.** | Un solo repositorio y un solo proceso de aplicación. Cada integrante debe poder defender un driver y su ADR. |
| C-08 | **Plazo:** sustentación el jueves 12/11/2026; hoy es 10/11/2026. | Se construye primero el núcleo y se recorta por la regla de corte. Lo que no se termine se documenta como trabajo futuro, nunca como hecho. |
| C-09 | **Entrega académica:** el diseño debe poder rastrearse de driver a decisión a código (rúbrica 1.6). | Matriz de trazabilidad y regla de dependencias automatizada en CI. |

## 3. Qué no es un driver

La configuración dinámica de precios, las tarifas versionadas, el diseño responsive y el rendimiento de la interfaz no son drivers del profesor. Se tratan como requisitos derivados o atributos secundarios (ver el árbol de utilidad), y no deben desplazar la estructura que sale de D1, D2 y D3.
