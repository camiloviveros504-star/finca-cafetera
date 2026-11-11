# ADR-001 · Estilo arquitectónico: monolito modular por capas

## 1. Título y estado
**Monolito modular por capas como estilo del sistema.** Estado: **Aceptado** (2026-11-10). Responsable de la defensa: integrante asignado al driver D1 (ver fichas de sustentación).

## 2. Contexto
El driver **D1 (consistencia del inventario)** exige que no se venda más café del disponible, también con ventas simultáneas (QA-01). Para eso, validar existencias, descontarlas y registrar la venta deben ocurrir **como una sola operación indivisible**. El driver **D3 (seguridad)** exige que toda operación pase por un control de permisos (QA-05) y el **D2** exige poder seguir la cadena cosecha → venta (QA-03).

Restricciones que pesan en la decisión: presupuesto cero y planes gratuitos (C-03, C-04, C-05), equipo de 3 personas (C-07) y plazo de dos días (C-08). Detalle en [01](../01-drivers-y-restricciones.md).

## 3. Decisión
Se construye **una sola aplicación** (Next.js) con **una sola base PostgreSQL**, organizada en módulos por contexto delimitado y en cuatro capas con dependencias en una sola dirección:

`presentación → aplicación → dominio ← infraestructura`

- La presentación nunca importa infraestructura ni el ORM.
- Los módulos se comunican solo a través de su capa de aplicación.
- La venta y el descuento de inventario comparten una transacción de base de datos abierta por la capa de aplicación.
- Una regla de dependency-cruiser en CI falla si alguien salta una capa.

## 4. Alternativas descartadas y por qué

| Alternativa | Por qué se descartó |
|---|---|
| **Microservicios** (identidad, producción, inventario y comercial como servicios con base propia) | Contradice D1: la venta y el descuento quedarían en servicios distintos, y habría que coordinarlos con sagas o compensaciones. Entre un paso y otro existe una ventana en la que el inventario es inconsistente. Además, multiplica los despliegues y las bases, que los planes gratuitos no soportan (C-03) y que un equipo de 3 no puede operar (C-07). |
| **Arquitectura orientada a eventos con un broker** (la venta publica un evento; el inventario lo consume y descuenta) | El descuento sería asíncrono: dos ventas podrían leer el mismo saldo antes de que llegue el evento. Para respetar D1 habría que añadir reservas y compensaciones. Un broker gestionado cuesta o es limitado en planes gratuitos, y depurar flujos asíncronos con poco tiempo es un riesgo. |
| **Monolito sin capas** (consultas SQL desde los componentes) | Sería más rápido de escribir, pero no permite demostrar que "no hay atajos" (rúbrica, criterio 4) ni garantizar D3: cualquier componente podría tocar la base sin autorizar. |
| **Funciones serverless independientes por caso de uso, sin módulos** | Cada función repetiría autorización, conexión y reglas. Aumenta las conexiones a la base (riesgo R-01) y diluye las reglas de negocio. |

## 5. Consecuencias

**Positivas**
- D1 se resuelve con una transacción ACID: o se confirma todo o no pasa nada.
- Un único punto de control de permisos (D3) y una única consulta recursiva para la trazabilidad (D2).
- Una sola aplicación y una sola base: cabe en Vercel Hobby y Render Free, y un equipo de 3 puede operarla.
- La estructura se puede verificar automáticamente (QA-13).

**Negativas (y por qué se aceptan)**
- **No hay escalado independiente por módulo.** Si las ventas se disparan, se escala toda la aplicación. Se acepta porque el primer límite será la base de datos y no el cómputo.
- **No hay despliegue independiente por módulo.** Se acepta con un equipo de 3.
- **Un fallo grave en un módulo puede afectar a todo el proceso.** Se mitiga con funciones serverless que aíslan cada solicitud.
- **Acoplamiento deliberado entre Comercial e Inventario** por compartir transacción. Se acepta porque es el precio de D1; queda limitado a una única llamada de la capa de aplicación.
- **Exige disciplina:** los módulos solo se mantienen separados si la regla de dependencias sigue verde.
- **Si el negocio creciera diez veces,** lo primero que se rompería sería la contención sobre las filas de existencias y el límite de conexiones de PostgreSQL (ver ADR-002 y riesgo R-01).
